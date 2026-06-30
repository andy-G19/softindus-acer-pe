"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { supplierSchema } from "@/schemas/inventory/supplier.schema";

function buildSequentialId(lastId: string | null | undefined, prefix: string) {
  if (!lastId) {
    return `${prefix}00000001`;
  }

  const currentNumber = Number(lastId.replace(prefix, ""));
  const nextNumber = currentNumber + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

function toNullable(value: string | undefined) {
  return value && value.trim() !== "" ? value.trim() : null;
}

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }
}

export async function createSupplierAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = session.user.role;

  requireAdmin(role);

  const parsed = supplierSchema.safeParse({
    razon_social: formData.get("razon_social"),
    tipo_documento: formData.get("tipo_documento"),
    numero_documento: formData.get("numero_documento"),
    telefono: formData.get("telefono"),
    correo: formData.get("correo"),
    direccion: formData.get("direccion"),
    contacto_principal: formData.get("contacto_principal"),
    tipo_proveedor: formData.get("tipo_proveedor"),
    condicion_pago: formData.get("condicion_pago"),
    observaciones: formData.get("observaciones"),
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  if (data.numero_documento) {
    const existingSupplier = await prisma.proveedor.findUnique({
      where: {
        numero_documento: data.numero_documento,
      },
    });

    if (existingSupplier) {
      throw new Error("Ya existe un proveedor con ese número de documento.");
    }
  }

  const lastSupplier = await prisma.proveedor.findFirst({
    orderBy: {
      id_proveedor: "desc",
    },
    select: {
      id_proveedor: true,
    },
  });

  const idProveedor = buildSequentialId(lastSupplier?.id_proveedor, "PVE");

  await prisma.proveedor.create({
    data: {
      id_proveedor: idProveedor,
      razon_social: data.razon_social,
      tipo_documento: data.tipo_documento ?? null,
      numero_documento: data.numero_documento ?? null,
      telefono: toNullable(data.telefono),
      correo: toNullable(data.correo),
      direccion: toNullable(data.direccion),
      contacto_principal: toNullable(data.contacto_principal),
      tipo_proveedor: data.tipo_proveedor,
      condicion_pago: data.condicion_pago ?? null,
      estado: true,
      observaciones: toNullable(data.observaciones),
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "proveedor",
    id_registro_afectado: idProveedor,
    accion: "crear",
    detalle: `Proveedor creado: ${data.razon_social}`,
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/inventory/suppliers");

  redirect("/dashboard/inventory/suppliers");
}
