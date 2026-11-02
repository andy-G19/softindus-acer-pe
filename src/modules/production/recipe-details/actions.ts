"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { ActionErrorState } from "@/lib/errors";
import { lockRecipeRow } from "@/lib/row-locks";
import { recipeDetailSchema } from "@/schemas/production/recipe-detail.schema";

export type RecipeDetailFormState = ActionErrorState;

type EditableVersion = {
  id_version_receta: string;
  id_receta: string;
};

// Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
type EditableVersionResult =
  | { ok: true; version: EditableVersion }
  | { ok: false; problem: RecipeDetailFormState };

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

async function loadActiveMaterial(tx: Prisma.TransactionClient, idMaterial: string) {
  return tx.material.findFirst({
    where: {
      id_material: idMaterial,
      estado: true,
    },
    select: {
      id_material: true,
      nombre_material: true,
      unidad_medida: true,
    },
  });
}

function materialProblem(message: string): EditableVersionResult {
  return { ok: false, problem: { error: message, fieldErrors: { id_material: [message] } } };
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

function detailsPath(idReceta: string, idVersion: string, toast: string) {
  return `/dashboard/production/recipes/${idReceta}/versions/${idVersion}/details?toast=${toast}`;
}

export async function createRecipeDetailAction(
  _prevState: RecipeDetailFormState,
  formData: FormData,
): Promise<RecipeDetailFormState> {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = parseRecipeDetailFormData(formData);

  if (!parsed.success) {
    return {
      error: "Revisa los datos del material.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  const result = await prisma.$transaction(async (tx): Promise<EditableVersionResult> => {
    await lockVersionRecipe(tx, data.id_version_receta);

    const versionResult = await loadEditableVersion(tx, data.id_version_receta);

    if (!versionResult.ok) {
      return versionResult;
    }

    const material = await loadActiveMaterial(tx, data.id_material);

    if (!material) {
      return materialProblem("El material seleccionado no existe o está inactivo.");
    }

    const duplicatedMaterial = await tx.detalle_receta.findFirst({
      where: {
        id_version_receta: data.id_version_receta,
        id_material: data.id_material,
      },
    });

    if (duplicatedMaterial) {
      return materialProblem("Este material ya está registrado en esta versión de receta.");
    }

    const idDetalleReceta = await getNextCorrelativeId(tx, {
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

  if (!result.ok) {
    return result.problem;
  }

  const { version } = result;

  revalidateRecipeDetailPaths(version.id_receta, version.id_version_receta);

  redirect(
    detailsPath(
      version.id_receta,
      version.id_version_receta,
      "recipe-detail-created",
    ),
  );
}

export async function updateRecipeDetailAction(
  _prevState: RecipeDetailFormState,
  formData: FormData,
): Promise<RecipeDetailFormState> {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idDetalleReceta = formData.get("id_detalle_receta")?.toString().trim();

  if (!idDetalleReceta) {
    return { error: "No se recibió el material de la receta." };
  }

  const parsed = parseRecipeDetailFormData(formData);

  if (!parsed.success) {
    return {
      error: "Revisa los datos del material.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;

  const result = await prisma.$transaction(async (tx): Promise<EditableVersionResult> => {
    await lockVersionRecipe(tx, data.id_version_receta);

    const detail = await tx.detalle_receta.findUnique({
      where: {
        id_detalle_receta: idDetalleReceta,
      },
      select: {
        id_detalle_receta: true,
        id_version_receta: true,
      },
    });

    if (!detail) {
      return { ok: false, problem: { error: "El material de la receta no existe." } };
    }

    if (detail.id_version_receta !== data.id_version_receta) {
      return { ok: false, problem: { error: "El material no pertenece a la versión indicada." } };
    }

    const versionResult = await loadEditableVersion(tx, data.id_version_receta);

    if (!versionResult.ok) {
      return versionResult;
    }

    const material = await loadActiveMaterial(tx, data.id_material);

    if (!material) {
      return materialProblem("El material seleccionado no existe o está inactivo.");
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
      return materialProblem("Este material ya está registrado en esta versión de receta.");
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

  if (!result.ok) {
    return result.problem;
  }

  const { version } = result;

  revalidateRecipeDetailPaths(version.id_receta, version.id_version_receta);

  redirect(
    detailsPath(
      version.id_receta,
      version.id_version_receta,
      "recipe-detail-updated",
    ),
  );
}

export async function deleteRecipeDetailAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idDetalleReceta = formData.get("id_detalle_receta")?.toString().trim();

  if (!idDetalleReceta) {
    throw new Error("No se recibió el material de la receta.");
  }

  const result = await prisma.$transaction(async (tx): Promise<EditableVersionResult> => {
    const owner = await tx.detalle_receta.findUnique({
      where: {
        id_detalle_receta: idDetalleReceta,
      },
      select: {
        id_version_receta: true,
      },
    });

    if (!owner) {
      return { ok: false, problem: { error: "El material de la receta no existe." } };
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
      return { ok: false, problem: { error: "El material de la receta no existe." } };
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

  if (!result.ok) {
    throw new Error(result.problem.error);
  }

  const { version } = result;

  revalidateRecipeDetailPaths(version.id_receta, version.id_version_receta);

  redirect(
    detailsPath(
      version.id_receta,
      version.id_version_receta,
      "recipe-detail-deleted",
    ),
  );
}
