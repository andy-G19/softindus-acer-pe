"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { recipeDetailSchema } from "@/schemas/production/recipe-detail.schema";

function requireProductionManager(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export async function createRecipeDetailAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = recipeDetailSchema.safeParse({
    id_version_receta: formData.get("id_version_receta"),
    id_material: formData.get("id_material"),
    cantidad_requerida: formData.get("cantidad_requerida"),
    tipo_consumo: formData.get("tipo_consumo"),
    merma_estimada_porcentaje:
      formData.get("merma_estimada_porcentaje") ?? "",
    observaciones: formData.get("observaciones") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const version = await prisma.version_receta.findFirst({
    where: {
      id_version_receta: data.id_version_receta,
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
    throw new Error("La versión de receta no existe o no está vigente.");
  }

  if (version.receta_tecnica.estado !== "activa") {
    throw new Error("La receta técnica no está activa.");
  }

  if (version.orden_trabajo.length > 0) {
    throw new Error(
      "No se puede modificar una versión de receta usada por órdenes de trabajo. Crea una nueva versión para conservar la trazabilidad.",
    );
  }

  const material = await prisma.material.findFirst({
    where: {
      id_material: data.id_material,
      estado: true,
    },
    select: {
      id_material: true,
      nombre_material: true,
      unidad_medida: true,
    },
  });

  if (!material) {
    throw new Error("El material seleccionado no existe o está inactivo.");
  }

  const duplicatedMaterial = await prisma.detalle_receta.findFirst({
    where: {
      id_version_receta: data.id_version_receta,
      id_material: data.id_material,
    },
  });

  if (duplicatedMaterial) {
    throw new Error("Este material ya está registrado en esta versión de receta.");
  }

  const lastDetail = await prisma.detalle_receta.findFirst({
    orderBy: {
      id_detalle_receta: "desc",
    },
    select: {
      id_detalle_receta: true,
    },
  });

  const idDetalleReceta = buildNextId("DRE", lastDetail?.id_detalle_receta);

  await prisma.$transaction(async (tx) => {
    await tx.detalle_receta.create({
      data: {
        id_detalle_receta: idDetalleReceta,
        id_version_receta: data.id_version_receta,
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
      detalle: `Material ${material.nombre_material} agregado a la versión ${data.id_version_receta}.`,
      tx,
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/recipes");
  revalidatePath(
    `/dashboard/production/recipes/${version.id_receta}/versions`,
  );
  revalidatePath(
    `/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`,
  );

  redirect(
    `/dashboard/production/recipes/${version.id_receta}/versions/${version.id_version_receta}/details`,
  );
}
