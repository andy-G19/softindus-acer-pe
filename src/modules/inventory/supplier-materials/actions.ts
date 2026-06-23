"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { supplierMaterialSchema } from "@/schemas/inventory/supplier-material.schema";

function buildSequentialId(lastId: string | null | undefined, prefix: string) {
  if (!lastId) {
    return `${prefix}00000001`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));
  const nextNumber = currentNumber + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/access-denied");
  }
}

export async function createSupplierMaterialAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsed = supplierMaterialSchema.safeParse({
    id_proveedor: formData.get("id_proveedor"),
    id_material: formData.get("id_material"),
    precio_referencial: formData.get("precio_referencial"),
    unidad_medida: formData.get("unidad_medida"),
    tiempo_entrega_dias: formData.get("tiempo_entrega_dias"),
    disponibilidad: formData.get("disponibilidad"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const supplier = await prisma.proveedor.findFirst({
    where: {
      id_proveedor: data.id_proveedor,
      estado: true,
    },
  });

  if (!supplier) {
    throw new Error("El proveedor seleccionado no existe o está inactivo.");
  }

  const material = await prisma.material.findFirst({
    where: {
      id_material: data.id_material,
      estado: true,
    },
  });

  if (!material) {
    throw new Error("El material seleccionado no existe o está inactivo.");
  }

  const existingRelation = await prisma.proveedor_material.findFirst({
    where: {
      id_proveedor: data.id_proveedor,
      id_material: data.id_material,
    },
  });

  if (existingRelation) {
    throw new Error("Este proveedor ya está asociado con el material seleccionado.");
  }

  const lastRelation = await prisma.proveedor_material.findFirst({
    orderBy: {
      id_proveedor_material: "desc",
    },
    select: {
      id_proveedor_material: true,
    },
  });

  const idProveedorMaterial = buildSequentialId(
    lastRelation?.id_proveedor_material,
    "PVM",
  );

  await prisma.proveedor_material.create({
    data: {
      id_proveedor_material: idProveedorMaterial,
      id_proveedor: data.id_proveedor,
      id_material: data.id_material,
      precio_referencial: data.precio_referencial ?? null,
      unidad_medida: data.unidad_medida,
      tiempo_entrega_dias: data.tiempo_entrega_dias
        ? Math.trunc(data.tiempo_entrega_dias)
        : null,
      disponibilidad: data.disponibilidad ?? null,
      estado: true,
      fecha_actualizacion: new Date(),
    },
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/supplier-materials");

  redirect("/dashboard/inventory/supplier-materials");
}