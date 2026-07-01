"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId, buildNextIds } from "@/lib/ids";
import {
  recipeVersionSchema,
  recipeVersionStatusSchema,
} from "@/schemas/production/recipe-version.schema";

function requireProductionManager(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function getFormDataValues(formData: FormData, name: string) {
  return formData.getAll(name).map((value) => String(value).trim());
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

export async function createRecipeVersionAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const materialIds = getFormDataValues(formData, "id_material");
  const quantities = getFormDataValues(formData, "cantidad_requerida");
  const consumptionTypes = getFormDataValues(formData, "tipo_consumo");
  const wastePercentages = getFormDataValues(
    formData,
    "merma_estimada_porcentaje",
  );
  const observations = getFormDataValues(formData, "observaciones_detalle");

  const details = materialIds.map((idMaterial, index) => ({
    id_material: idMaterial,
    cantidad_requerida: quantities[index] ?? "",
    tipo_consumo: consumptionTypes[index] ?? "",
    merma_estimada_porcentaje: wastePercentages[index] ?? "0",
    observaciones: observations[index] ?? "",
  }));

  const parsed = recipeVersionSchema.safeParse({
    id_receta: formData.get("id_receta"),
    numero_version: formData.get("numero_version") ?? "",
    motivo_cambio: formData.get("motivo_cambio") ?? "",
    detalles: details,
  });

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsed.data;

  const recipe = await prisma.receta_tecnica.findFirst({
    where: {
      id_receta: data.id_receta,
      estado: "activa",
    },
    include: {
      version_receta: {
        orderBy: {
          fecha_version: "desc",
        },
        take: 1,
      },
    },
  });

  if (!recipe) {
    throw new Error("La receta técnica no existe o está inactiva.");
  }

  const materials = await prisma.material.findMany({
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

  const missingMaterials = data.detalles.filter((detail) => {
    return !materialById.has(detail.id_material);
  });

  if (missingMaterials.length > 0) {
    throw new Error(
      "Uno o más materiales seleccionados no existen o están inactivos.",
    );
  }

  const recipeVersions = await prisma.version_receta.findMany({
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

  const duplicatedVersionNumber = await prisma.version_receta.findFirst({
    where: {
      id_receta: data.id_receta,
      numero_version: versionNumber,
    },
    select: {
      id_version_receta: true,
    },
  });

  if (duplicatedVersionNumber) {
    throw new Error("Ya existe una versión con ese número para esta receta.");
  }

  const [lastVersionId, lastDetail] = await Promise.all([
    prisma.version_receta.findFirst({
      orderBy: {
        id_version_receta: "desc",
      },
      select: {
        id_version_receta: true,
      },
    }),
    prisma.detalle_receta.findFirst({
      orderBy: {
        id_detalle_receta: "desc",
      },
      select: {
        id_detalle_receta: true,
      },
    }),
  ]);

  const idVersionReceta = buildNextId(
    "VER",
    lastVersionId?.id_version_receta,
  );
  const detailIds = buildNextIds(
    "DRE",
    lastDetail?.id_detalle_receta,
    data.detalles.length,
  );

  await prisma.$transaction(async (tx) => {
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
  });

  revalidateRecipePaths(data.id_receta);
  revalidatePath(
    `/dashboard/production/recipes/${data.id_receta}/versions/${idVersionReceta}/details`,
  );

  redirect(`/dashboard/production/recipes/${data.id_receta}/versions`);
}

export async function setCurrentRecipeVersionAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = recipeVersionStatusSchema.safeParse({
    id_receta: formData.get("id_receta"),
    id_version_receta: formData.get("id_version_receta"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const version = await prisma.version_receta.findFirst({
    where: {
      id_version_receta: data.id_version_receta,
      id_receta: data.id_receta,
    },
    include: {
      receta_tecnica: true,
    },
  });

  if (!version) {
    throw new Error("La versión seleccionada no existe.");
  }

  if (version.receta_tecnica.estado !== "activa") {
    throw new Error("La receta técnica no está activa.");
  }

  if (version.estado === "anulada") {
    throw new Error("No se puede marcar como vigente una versión anulada.");
  }

  if (version.estado === "vigente") {
    revalidateRecipePaths(data.id_receta);
    redirect(`/dashboard/production/recipes/${data.id_receta}/versions`);
  }

  await prisma.$transaction(async (tx) => {
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
  });

  revalidateRecipePaths(data.id_receta);

  redirect(`/dashboard/production/recipes/${data.id_receta}/versions`);
}

export async function voidRecipeVersionAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = recipeVersionStatusSchema.safeParse({
    id_receta: formData.get("id_receta"),
    id_version_receta: formData.get("id_version_receta"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const version = await prisma.version_receta.findFirst({
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
    throw new Error("La versión seleccionada no existe.");
  }

  if (version.estado === "anulada") {
    throw new Error("La versión ya se encuentra anulada.");
  }

  if (version.orden_trabajo.length > 0) {
    throw new Error(
      "No se puede anular una versión usada por órdenes de trabajo. Se conserva como histórica.",
    );
  }

  if (version.estado === "vigente") {
    const replacement = await prisma.version_receta.findFirst({
      where: {
        id_receta: data.id_receta,
        id_version_receta: {
          not: data.id_version_receta,
        },
        estado: {
          not: "anulada",
        },
      },
      orderBy: {
        fecha_version: "desc",
      },
      select: {
        id_version_receta: true,
      },
    });

    if (!replacement) {
      throw new Error(
        "No se puede anular la única versión vigente sin otra versión válida para reemplazarla.",
      );
    }

    await prisma.$transaction(async (tx) => {
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
    });
  } else {
    await prisma.$transaction(async (tx) => {
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
    });
  }

  revalidateRecipePaths(data.id_receta);

  redirect(`/dashboard/production/recipes/${data.id_receta}/versions`);
}
