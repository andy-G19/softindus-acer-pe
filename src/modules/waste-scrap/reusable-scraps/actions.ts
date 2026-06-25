"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { reusableScrapSchema } from "@/schemas/waste-scrap/reusable-scrap.schema";

function buildSequentialId(lastId: string | null | undefined, prefix: string) {
  if (!lastId) {
    return `${prefix}00000001`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));

  if (Number.isNaN(currentNumber)) {
    return `${prefix}00000001`;
  }

  const nextNumber = currentNumber + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function requireWasteScrapAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export async function createReusableScrapAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireWasteScrapAccess(session.user.role);

  const parsedData = reusableScrapSchema.safeParse({
    id_material: formData.get("id_material"),
    id_orden_trabajo: formData.get("id_orden_trabajo"),
    medida_aproximada: formData.get("medida_aproximada"),
    cantidad: formData.get("cantidad"),
    unidad_medida: formData.get("unidad_medida"),
    ubicacion: formData.get("ubicacion"),
  });

  if (!parsedData.success) {
    const message = parsedData.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsedData.data;

  const material = await prisma.material.findUnique({
    where: {
      id_material: data.id_material,
    },
    select: {
      id_material: true,
      nombre_material: true,
      categoria: true,
      unidad_medida: true,
      estado: true,
    },
  });

  if (!material) {
    throw new Error("El material seleccionado no existe.");
  }

  if (!material.estado) {
    throw new Error("No se puede registrar retazos de un material inactivo.");
  }

  if (data.id_orden_trabajo) {
    const workOrder = await prisma.orden_trabajo.findUnique({
      where: {
        id_orden_trabajo: data.id_orden_trabajo,
      },
      select: {
        id_orden_trabajo: true,
        estado: true,
      },
    });

    if (!workOrder) {
      throw new Error("La orden de trabajo seleccionada no existe.");
    }

    if (workOrder.estado === "anulada") {
      throw new Error("No se puede asociar un retazo a una orden anulada.");
    }
  }

  const lastReusableScrap = await prisma.retazo_reutilizable.findFirst({
    orderBy: {
      id_retazo: "desc",
    },
    select: {
      id_retazo: true,
    },
  });

  const idRetazo = buildSequentialId(lastReusableScrap?.id_retazo, "RET");

  await prisma.retazo_reutilizable.create({
    data: {
      id_retazo: idRetazo,
      id_material: data.id_material,
      id_orden_trabajo: data.id_orden_trabajo,
      tipo_material: material.categoria,
      medida_aproximada: data.medida_aproximada,
      cantidad: data.cantidad,
      unidad_medida: data.unidad_medida,
      ubicacion: data.ubicacion,
      estado: "disponible",
      id_usuario_registro: session.user.id,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/waste-scrap");

  redirect("/dashboard/waste-scrap");
}