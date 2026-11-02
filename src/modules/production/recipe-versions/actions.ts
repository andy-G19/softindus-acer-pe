"use server";

import { revalidatePath } from "next/cache";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { rowStatusDone, rowStatusError, type RowStatusState } from "@/lib/requested-status";
import { lockRecipeRow } from "@/lib/row-locks";
import {
  recipeVersionSchema,
  recipeVersionStatusSchema,
} from "@/schemas/production/recipe-version.schema";

export type RecipeVersionLineValues = {
  id_material: string;
  cantidad_requerida: string;
  tipo_consumo: string;
  merma_estimada_porcentaje: string;
  observaciones: string;
};

export type RecipeVersionFormValues = {
  id_receta: string;
  numero_version: string;
  motivo_cambio: string;
  detalles: RecipeVersionLineValues[];
};

// Entrega 10.6b: el alta no redirige; devuelve el resultado y el formulario da el
// aviso y vuelve a la lista. Los errores de una linea van con la clave
// detalles.<linea>.<campo>, con la posicion de la linea en el formulario.
export type RecipeVersionFormState = FormActionState<RecipeVersionFormValues, { id_version_receta: string }>;

type VersionProblem = { error: string; fieldErrors?: FieldErrors };

const PERMISSION_ERROR = "No tienes permisos para cambiar las versiones de receta.";

function getFormDataValues(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value).trim());
}

function getVersionFormValues(formData: FormData): RecipeVersionFormValues {
  const quantities = getFormDataValues(formData, "cantidad_requerida");
  const consumptionTypes = getFormDataValues(formData, "tipo_consumo");
  const wastePercentages = getFormDataValues(formData, "merma_estimada_porcentaje");
  const observations = getFormDataValues(formData, "observaciones_detalle");

  return {
    id_receta: formData.get("id_receta")?.toString() ?? "",
    numero_version: formData.get("numero_version")?.toString() ?? "",
    motivo_cambio: formData.get("motivo_cambio")?.toString() ?? "",
    detalles: getFormDataValues(formData, "id_material").map((idMaterial, index) => ({
      id_material: idMaterial,
      cantidad_requerida: quantities[index] ?? "",
      tipo_consumo: consumptionTypes[index] ?? "",
      merma_estimada_porcentaje: wastePercentages[index] ?? "0",
      observaciones: observations[index] ?? "",
    })),
  };
}

function versionError(values: RecipeVersionFormValues, error: string, fieldErrors?: FieldErrors): RecipeVersionFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

// Las claves se construyen con la ruta de cada problema porque flatten de Zod no
// conserva las rutas anidadas.
function versionFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of issues) {
    const key = issue.path.join(".");

    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }

  return fieldErrors;
}

function getNextVersionNumber(versionNumbers: string[]) {
  const highestVersionNumber = versionNumbers.reduce((highest, version) => {
    const match = version.match(/(\d+)(?!.*\d)/);

    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0);

  return `V${highestVersionNumber + 1}`;
}

function revalidateRecipePaths(idReceta: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/recipes");
  revalidatePath(`/dashboard/production/recipes/${idReceta}/versions`);
  revalidatePath("/dashboard/production/work-orders");
}

export async function createRecipeVersionAction(
  _prevState: RecipeVersionFormState,
  formData: FormData,
): Promise<RecipeVersionFormState> {
  const values = getVersionFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return versionError(values, PERMISSION_ERROR);
  }

  const parsed = recipeVersionSchema.safeParse({
    id_receta: formData.get("id_receta"),
    numero_version: formData.get("numero_version") ?? "",
    motivo_cambio: formData.get("motivo_cambio") ?? "",
    detalles: values.detalles,
  });

  if (!parsed.success) {
    const fieldErrors = versionFieldErrors(parsed.error.issues);

    return versionError(
      values,
      fieldErrors.id_receta?.[0] ?? fieldErrors.detalles?.[0] ?? "Revisa los datos de la versión.",
      fieldErrors,
    );
  }

  const data = parsed.data;

  let idVersionReceta = "";

  // El candado de la receta pone en fila a todo lo que escribe sus versiones: la
  // segunda de dos altas lee el numero y la vigente que dejo la primera. Un rechazo
  // vuelve del callback sin escribir nada y la transaccion termina.
  let problem: VersionProblem | null = null;

  try {
    problem = await prisma.$transaction(async (tx): Promise<VersionProblem | null> => {
      await lockRecipeRow(tx, data.id_receta);

      const recipe = await tx.receta_tecnica.findFirst({
        where: {
          id_receta: data.id_receta,
          estado: "activa",
        },
        select: {
          id_receta: true,
        },
      });

      if (!recipe) {
        return { error: "La receta técnica no existe o está inactiva." };
      }

      const materials = await tx.material.findMany({
        where: {
          id_material: {
            in: data.detalles.map((detail) => detail.id_material),
          },
          estado: true,
        },
        select: {
          id_material: true,
          unidad_medida: true,
        },
      });

      const materialById = new Map(
        materials.map((material) => [material.id_material, material]),
      );

      const missingLines = data.detalles.flatMap((detail, line) => (materialById.has(detail.id_material) ? [] : [line]));

      if (missingLines.length > 0) {
        return {
          error: "Uno o más materiales seleccionados no existen o están inactivos.",
          fieldErrors: Object.fromEntries(
            missingLines.map((line) => [
              `detalles.${line}.id_material`,
              ["El material seleccionado no existe o está inactivo."],
            ]),
          ),
        };
      }

      const recipeVersions = await tx.version_receta.findMany({
        where: {
          id_receta: data.id_receta,
        },
        select: {
          numero_version: true,
        },
      });

      const versionNumber =
        data.numero_version ??
        getNextVersionNumber(
          recipeVersions.map((version) => version.numero_version),
        );

      const duplicatedVersionNumber = await tx.version_receta.findFirst({
        where: {
          id_receta: data.id_receta,
          numero_version: versionNumber,
        },
        select: {
          id_version_receta: true,
        },
      });

      if (duplicatedVersionNumber) {
        return { error: "Ya existe una versión con ese número para esta receta." };
      }

      idVersionReceta = await getNextCorrelativeId(tx, {
        codigoEntidad: "version_receta",
        prefijo: "VER",
      });
      const detailIds = await getNextCorrelativeIds(tx, {
        codigoEntidad: "detalle_receta",
        prefijo: "DRE",
        cantidad: data.detalles.length,
      });

      await tx.version_receta.updateMany({
        where: {
          id_receta: data.id_receta,
          estado: "vigente",
        },
        data: {
          estado: "reemplazada",
        },
      });

      await tx.version_receta.create({
        data: {
          id_version_receta: idVersionReceta,
          id_receta: data.id_receta,
          numero_version: versionNumber,
          motivo_cambio: data.motivo_cambio,
          estado: "vigente",
          id_usuario_aprueba: session.user.id,
        },
      });

      await tx.detalle_receta.createMany({
        data: data.detalles.map((detail, index) => {
          const material = materialById.get(detail.id_material);

          if (!material) {
            throw new Error("No se pudo resolver la unidad de medida del material.");
          }

          return {
            id_detalle_receta: detailIds[index],
            id_version_receta: idVersionReceta,
            id_material: detail.id_material,
            cantidad_requerida: detail.cantidad_requerida,
            unidad_medida: material.unidad_medida,
            tipo_consumo: detail.tipo_consumo,
            merma_estimada_porcentaje: detail.merma_estimada_porcentaje,
            observaciones: detail.observaciones,
          };
        }),
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "version_receta",
        id_registro_afectado: idVersionReceta,
        accion: "CREAR_VERSION_RECETA",
        detalle: `Nueva versión vigente ${versionNumber} creada para la receta ${data.id_receta} con ${data.detalles.length} material(es).`,
        tx,
      });

      return null;
    });
  } catch {
    return versionError(values, "No se pudo crear la versión. Intenta nuevamente.");
  }

  if (problem) {
    return versionError(values, problem.error, problem.fieldErrors);
  }

  revalidateRecipePaths(data.id_receta);
  revalidatePath(
    `/dashboard/production/recipes/${data.id_receta}/versions/${idVersionReceta}/details`,
  );

  return { status: "success", data: { id_version_receta: idVersionReceta }, values, operationId: newOperationId() };
}

export async function setCurrentRecipeVersionAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const id = formData.get("id_version_receta")?.toString() ?? "";
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return rowStatusError(id, PERMISSION_ERROR);
  }

  const parsed = recipeVersionStatusSchema.safeParse({
    id_receta: formData.get("id_receta"),
    id_version_receta: formData.get("id_version_receta"),
  });

  if (!parsed.success) {
    return rowStatusError(id, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  let problem: VersionProblem | null = null;

  try {
    problem = await prisma.$transaction(async (tx): Promise<VersionProblem | null> => {
      await lockRecipeRow(tx, data.id_receta);

      const version = await tx.version_receta.findFirst({
        where: {
          id_version_receta: data.id_version_receta,
          id_receta: data.id_receta,
        },
        include: {
          receta_tecnica: true,
        },
      });

      if (!version) {
        return { error: "La versión seleccionada no existe." };
      }

      if (version.receta_tecnica.estado !== "activa") {
        return { error: "La receta técnica no está activa." };
      }

      if (version.estado === "anulada") {
        return { error: "No se puede marcar como vigente una versión anulada." };
      }

      if (version.estado === "vigente") {
        return { error: "La versión ya estaba vigente." };
      }

      await tx.version_receta.updateMany({
        where: {
          id_receta: data.id_receta,
          estado: "vigente",
        },
        data: {
          estado: "reemplazada",
        },
      });

      await tx.version_receta.update({
        where: {
          id_version_receta: data.id_version_receta,
        },
        data: {
          estado: "vigente",
          id_usuario_aprueba: session.user.id,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "version_receta",
        id_registro_afectado: data.id_version_receta,
        accion: "CAMBIAR_VERSION_VIGENTE",
        detalle: `La versión ${version.numero_version} fue marcada como vigente para la receta ${data.id_receta}.`,
        tx,
      });

      return null;
    });
  } catch {
    return rowStatusError(id, "No se pudo marcar la versión como vigente. Intenta nuevamente.");
  }

  if (problem) {
    return rowStatusError(id, problem.error);
  }

  revalidateRecipePaths(data.id_receta);

  return rowStatusDone(id, "vigente");
}

export async function voidRecipeVersionAction(
  _prevState: RowStatusState,
  formData: FormData,
): Promise<RowStatusState> {
  const id = formData.get("id_version_receta")?.toString() ?? "";
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return rowStatusError(id, PERMISSION_ERROR);
  }

  const parsed = recipeVersionStatusSchema.safeParse({
    id_receta: formData.get("id_receta"),
    id_version_receta: formData.get("id_version_receta"),
  });

  if (!parsed.success) {
    return rowStatusError(id, parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  let problem: VersionProblem | null = null;

  try {
    problem = await prisma.$transaction(async (tx): Promise<VersionProblem | null> => {
      await lockRecipeRow(tx, data.id_receta);

      const version = await tx.version_receta.findFirst({
        where: {
          id_version_receta: data.id_version_receta,
          id_receta: data.id_receta,
        },
        include: {
          orden_trabajo: {
            select: {
              id_orden_trabajo: true,
            },
          },
        },
      });

      if (!version) {
        return { error: "La versión seleccionada no existe." };
      }

      if (version.estado === "anulada") {
        return { error: "La versión ya se encuentra anulada." };
      }

      if (version.orden_trabajo.length > 0) {
        return {
          error:
            "No se puede anular una versión usada por órdenes de trabajo. Se conserva como histórica.",
        };
      }

      if (version.estado === "vigente") {
        // fecha_version no guarda la hora: entre versiones del mismo dia decide el
        // correlativo, que siempre crece.
        const replacement = await tx.version_receta.findFirst({
          where: {
            id_receta: data.id_receta,
            id_version_receta: {
              not: data.id_version_receta,
            },
            estado: {
              not: "anulada",
            },
          },
          orderBy: [{ fecha_version: "desc" }, { id_version_receta: "desc" }],
          select: {
            id_version_receta: true,
          },
        });

        if (!replacement) {
          return {
            error:
              "No se puede anular la única versión vigente sin otra versión válida para reemplazarla.",
          };
        }

        await tx.version_receta.update({
          where: {
            id_version_receta: data.id_version_receta,
          },
          data: {
            estado: "anulada",
          },
        });

        await tx.version_receta.update({
          where: {
            id_version_receta: replacement.id_version_receta,
          },
          data: {
            estado: "vigente",
            id_usuario_aprueba: session.user.id,
          },
        });

        await registerAuditLog({
          userId: session.user.id,
          entidad_afectada: "version_receta",
          id_registro_afectado: data.id_version_receta,
          accion: "ANULAR_VERSION_RECETA",
          detalle: `Versión ${version.numero_version} anulada y reemplazada por ${replacement.id_version_receta}.`,
          tx,
        });
      } else {
        await tx.version_receta.update({
          where: {
            id_version_receta: data.id_version_receta,
          },
          data: {
            estado: "anulada",
          },
        });

        await registerAuditLog({
          userId: session.user.id,
          entidad_afectada: "version_receta",
          id_registro_afectado: data.id_version_receta,
          accion: "ANULAR_VERSION_RECETA",
          detalle: `Versión ${version.numero_version} anulada para la receta ${data.id_receta}.`,
          tx,
        });
      }

      return null;
    });
  } catch {
    return rowStatusError(id, "No se pudo anular la versión. Intenta nuevamente.");
  }

  if (problem) {
    return rowStatusError(id, problem.error);
  }

  revalidateRecipePaths(data.id_receta);

  return rowStatusDone(id, "anulada");
}
