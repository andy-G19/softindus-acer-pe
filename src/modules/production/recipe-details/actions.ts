"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import { lockRecipeRow } from "@/lib/row-locks";
import { recipeDetailSchema } from "@/schemas/production/recipe-detail.schema";

/** Lo que el formulario de la linea envio, tal cual, para volver a mostrarlo. */
export type RecipeDetailFormValues = {
  id_material: string;
  cantidad_requerida: string;
  merma_estimada_porcentaje: string;
  tipo_consumo: string;
  observaciones: string;
};

// Entrega 10.6b: el alta y la edicion se usan desde el panel lateral y devuelven el
// resultado; sin permiso responden con un error, no redirigen.
export type RecipeDetailFormState = FormActionState<RecipeDetailFormValues, { id_detalle_receta: string }>;

export type RecipeDetailDeleteState = FormActionState<{ id_detalle_receta: string }, { id_detalle_receta: string }>;

type EditableVersion = {
  id_version_receta: string;
  id_receta: string;
};

type DetailProblem = { error: string; fieldErrors?: FieldErrors };

// Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
type EditableVersionResult =
  | { ok: true; version: EditableVersion }
  | { ok: false; problem: DetailProblem };

const DUPLICATED_MATERIAL = "Este material ya está registrado en esta versión de receta.";
const INACTIVE_MATERIAL = "El material seleccionado no existe o está inactivo.";
const MISSING_DETAIL = "El material de la receta no existe.";
const PERMISSION_ERROR = "No tienes permisos para gestionar recetas técnicas.";

function getDetailFormValues(formData: FormData): RecipeDetailFormValues {
  const text = (name: keyof RecipeDetailFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_material: text("id_material"),
    cantidad_requerida: text("cantidad_requerida"),
    merma_estimada_porcentaje: text("merma_estimada_porcentaje"),
    tipo_consumo: text("tipo_consumo"),
    observaciones: text("observaciones"),
  };
}

function detailError(
  values: RecipeDetailFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): RecipeDetailFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function deleteError(idDetalleReceta: string, error: string): RecipeDetailDeleteState {
  return { status: "error", error, values: { id_detalle_receta: idDetalleReceta }, operationId: newOperationId() };
}

function materialProblem(message: string): EditableVersionResult {
  return { ok: false, problem: { error: message, fieldErrors: { id_material: [message] } } };
}

// Con el candado de la receta una carrera por el material no deberia llegar a
// uq_detalle_receta_material; si llega, se responde como el duplicado.
function detailSaveProblem(error: unknown): EditableVersionResult {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return materialProblem(DUPLICATED_MATERIAL);
  }

  return { ok: false, problem: { error: "No se pudo guardar el material. Intenta nuevamente." } };
}

/**
 * Una linea no tiene candado propio: la protege el de su receta, el mismo que toman
 * marcar vigente y anular. La version no cambia de receta, asi que se puede leer su
 * id_receta sin candado; lo que decide se lee despues, ya bloqueado.
 */
async function lockVersionRecipe(tx: Prisma.TransactionClient, idVersionReceta: string) {
  const version = await tx.version_receta.findUnique({
    where: {
      id_version_receta: idVersionReceta,
    },
    select: {
      id_receta: true,
    },
  });

  if (version) {
    await lockRecipeRow(tx, version.id_receta);
  }
}

/**
 * Una version de receta solo se puede editar mientras sea vigente, su receta este activa
 * y ninguna orden de trabajo la haya usado.
 *
 * Ese ultimo punto es el que sostiene la trazabilidad: desde que existe la primera orden,
 * la version queda congelada y cualquier cambio exige crear una version nueva. Antes de
 * eso la receta todavia se esta escribiendo, y ahi si tiene sentido corregir.
 */
async function loadEditableVersion(
  tx: Prisma.TransactionClient,
  idVersionReceta: string,
): Promise<EditableVersionResult> {
  const version = await tx.version_receta.findFirst({
    where: {
      id_version_receta: idVersionReceta,
      estado: "vigente",
    },
    include: {
      receta_tecnica: true,
      orden_trabajo: {
        select: {
          id_orden_trabajo: true,
        },
      },
    },
  });

  if (!version) {
    return { ok: false, problem: { error: "La versión de receta no existe o no está vigente." } };
  }

  if (version.receta_tecnica.estado !== "activa") {
    return { ok: false, problem: { error: "La receta técnica no está activa." } };
  }

  if (version.orden_trabajo.length > 0) {
    return {
      ok: false,
      problem: {
        error:
          "No se puede modificar una versión de receta usada por órdenes de trabajo. Crea una nueva versión para conservar la trazabilidad.",
      },
    };
  }

  return {
    ok: true,
    version: {
      id_version_receta: version.id_version_receta,
      id_receta: version.id_receta,
    },
  };
}

function parseRecipeDetailFormData(formData: FormData) {
  return recipeDetailSchema.safeParse({
    id_version_receta: formData.get("id_version_receta"),
    id_material: formData.get("id_material"),
    cantidad_requerida: formData.get("cantidad_requerida"),
    tipo_consumo: formData.get("tipo_consumo"),
    merma_estimada_porcentaje: formData.get("merma_estimada_porcentaje") ?? "",
    observaciones: formData.get("observaciones") ?? "",
  });
}

// El material actual de la linea se conserva aunque hoy este inactivo, como en
// pedidos; uno nuevo debe estar activo.
async function loadSelectableMaterial(
  tx: Prisma.TransactionClient,
  idMaterial: string,
  currentMaterial?: string,
) {
  return tx.material.findFirst({
    where: {
      id_material: idMaterial,
      ...(idMaterial === currentMaterial ? {} : { estado: true }),
    },
    select: {
      id_material: true,
      nombre_material: true,
      unidad_medida: true,
    },
  });
}

function revalidateRecipeDetailPaths(idReceta: string, idVersion: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/recipes");
  revalidatePath(`/dashboard/production/recipes/${idReceta}/versions`);
  revalidatePath(
    `/dashboard/production/recipes/${idReceta}/versions/${idVersion}/details`,
  );
}

export async function createRecipeDetailAction(
  _prevState: RecipeDetailFormState,
  formData: FormData,
): Promise<RecipeDetailFormState> {
  const values = getDetailFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return detailError(values, PERMISSION_ERROR);
  }

  const parsed = parseRecipeDetailFormData(formData);

  if (!parsed.success) {
    return detailError(values, "Revisa los datos del material.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  let idDetalleReceta = "";
  let result: EditableVersionResult;

  try {
    result = await prisma.$transaction(async (tx): Promise<EditableVersionResult> => {
      await lockVersionRecipe(tx, data.id_version_receta);

      const versionResult = await loadEditableVersion(tx, data.id_version_receta);

      if (!versionResult.ok) {
        return versionResult;
      }

      const material = await loadSelectableMaterial(tx, data.id_material);

      if (!material) {
        return materialProblem(INACTIVE_MATERIAL);
      }

      const duplicatedMaterial = await tx.detalle_receta.findFirst({
        where: {
          id_version_receta: data.id_version_receta,
          id_material: data.id_material,
        },
      });

      if (duplicatedMaterial) {
        return materialProblem(DUPLICATED_MATERIAL);
      }

      idDetalleReceta = await getNextCorrelativeId(tx, {
        codigoEntidad: "detalle_receta",
        prefijo: "DRE",
      });

      await tx.detalle_receta.create({
        data: {
          id_detalle_receta: idDetalleReceta,
          id_version_receta: data.id_version_receta,
          id_material: data.id_material,
          cantidad_requerida: data.cantidad_requerida,
          // La unidad se copia del material: el usuario nunca la escribe, para que no pueda
          // quedar una receta expresada en una unidad distinta a la del inventario.
          unidad_medida: material.unidad_medida,
          tipo_consumo: data.tipo_consumo,
          merma_estimada_porcentaje: data.merma_estimada_porcentaje,
          observaciones: data.observaciones,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "detalle_receta",
        id_registro_afectado: idDetalleReceta,
        accion: "MODIFICAR_DETALLE_RECETA",
        detalle: `Material ${material.nombre_material} agregado a la versión ${data.id_version_receta}.`,
        tx,
      });

      return versionResult;
    });
  } catch (error) {
    result = detailSaveProblem(error);
  }

  if (!result.ok) {
    return detailError(values, result.problem.error, result.problem.fieldErrors);
  }

  revalidateRecipeDetailPaths(result.version.id_receta, result.version.id_version_receta);

  return { status: "success", data: { id_detalle_receta: idDetalleReceta }, values, operationId: newOperationId() };
}

export async function updateRecipeDetailAction(
  _prevState: RecipeDetailFormState,
  formData: FormData,
): Promise<RecipeDetailFormState> {
  const values = getDetailFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return detailError(values, PERMISSION_ERROR);
  }

  const idDetalleReceta = formData.get("id_detalle_receta")?.toString().trim();

  if (!idDetalleReceta) {
    return detailError(values, "No se recibió el material de la receta.");
  }

  const parsed = parseRecipeDetailFormData(formData);

  if (!parsed.success) {
    return detailError(values, "Revisa los datos del material.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  let result: EditableVersionResult;

  try {
    result = await prisma.$transaction(async (tx): Promise<EditableVersionResult> => {
      await lockVersionRecipe(tx, data.id_version_receta);

      const detail = await tx.detalle_receta.findUnique({
        where: {
          id_detalle_receta: idDetalleReceta,
        },
        select: {
          id_detalle_receta: true,
          id_version_receta: true,
          id_material: true,
        },
      });

      if (!detail) {
        return { ok: false, problem: { error: MISSING_DETAIL } };
      }

      if (detail.id_version_receta !== data.id_version_receta) {
        return { ok: false, problem: { error: "El material no pertenece a la versión indicada." } };
      }

      const versionResult = await loadEditableVersion(tx, data.id_version_receta);

      if (!versionResult.ok) {
        return versionResult;
      }

      const material = await loadSelectableMaterial(tx, data.id_material, detail.id_material);

      if (!material) {
        return materialProblem(INACTIVE_MATERIAL);
      }

      // Se permite cambiar el material de la linea; hay que revalidar el duplicado
      // excluyendo la propia fila.
      const duplicatedMaterial = await tx.detalle_receta.findFirst({
        where: {
          id_version_receta: data.id_version_receta,
          id_material: data.id_material,
          id_detalle_receta: {
            not: idDetalleReceta,
          },
        },
      });

      if (duplicatedMaterial) {
        return materialProblem(DUPLICATED_MATERIAL);
      }

      await tx.detalle_receta.update({
        where: {
          id_detalle_receta: idDetalleReceta,
        },
        data: {
          id_material: data.id_material,
          cantidad_requerida: data.cantidad_requerida,
          unidad_medida: material.unidad_medida,
          tipo_consumo: data.tipo_consumo,
          merma_estimada_porcentaje: data.merma_estimada_porcentaje,
          observaciones: data.observaciones,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "detalle_receta",
        id_registro_afectado: idDetalleReceta,
        accion: "MODIFICAR_DETALLE_RECETA",
        detalle: `Material ${material.nombre_material} actualizado en la versión ${data.id_version_receta}.`,
        tx,
      });

      return versionResult;
    });
  } catch (error) {
    result = detailSaveProblem(error);
  }

  if (!result.ok) {
    return detailError(values, result.problem.error, result.problem.fieldErrors);
  }

  revalidateRecipeDetailPaths(result.version.id_receta, result.version.id_version_receta);

  return { status: "success", data: { id_detalle_receta: idDetalleReceta }, values, operationId: newOperationId() };
}

export async function deleteRecipeDetailAction(
  _prevState: RecipeDetailDeleteState,
  formData: FormData,
): Promise<RecipeDetailDeleteState> {
  const idDetalleReceta = formData.get("id_detalle_receta")?.toString().trim() ?? "";
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return deleteError(idDetalleReceta, PERMISSION_ERROR);
  }

  if (!idDetalleReceta) {
    return deleteError(idDetalleReceta, "No se recibió el material de la receta.");
  }

  let result: EditableVersionResult;

  try {
    result = await prisma.$transaction(async (tx): Promise<EditableVersionResult> => {
      const owner = await tx.detalle_receta.findUnique({
        where: {
          id_detalle_receta: idDetalleReceta,
        },
        select: {
          id_version_receta: true,
        },
      });

      if (!owner) {
        return { ok: false, problem: { error: MISSING_DETAIL } };
      }

      await lockVersionRecipe(tx, owner.id_version_receta);

      // Otra operacion pudo borrar o cambiar la linea mientras esta esperaba el candado.
      const detail = await tx.detalle_receta.findUnique({
        where: {
          id_detalle_receta: idDetalleReceta,
        },
        include: {
          material: {
            select: {
              nombre_material: true,
            },
          },
        },
      });

      if (!detail) {
        return { ok: false, problem: { error: MISSING_DETAIL } };
      }

      const versionResult = await loadEditableVersion(tx, detail.id_version_receta);

      if (!versionResult.ok) {
        return versionResult;
      }

      // Borrado fisico: detalle_receta no tiene columna de estado, y la guarda anterior
      // asegura que ninguna orden de trabajo referencia esta version.
      await tx.detalle_receta.delete({
        where: {
          id_detalle_receta: idDetalleReceta,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "detalle_receta",
        id_registro_afectado: idDetalleReceta,
        accion: "MODIFICAR_DETALLE_RECETA",
        detalle: `Material ${detail.material.nombre_material} eliminado de la versión ${detail.id_version_receta}.`,
        tx,
      });

      return versionResult;
    });
  } catch {
    result = { ok: false, problem: { error: "No se pudo eliminar el material. Intenta nuevamente." } };
  }

  if (!result.ok) {
    return deleteError(idDetalleReceta, result.problem.error);
  }

  revalidateRecipeDetailPaths(result.version.id_receta, result.version.id_version_receta);

  return {
    status: "success",
    data: { id_detalle_receta: idDetalleReceta },
    values: { id_detalle_receta: idDetalleReceta },
    operationId: newOperationId(),
  };
}
