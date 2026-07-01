"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { inventoryCatalogSchema } from "@/schemas/inventory/catalog.schema";

export type InventoryCatalogFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const INVENTORY_PATH = "/dashboard/inventory";
const SUPPLIERS_PATH = "/dashboard/inventory/suppliers";
const SUPPLIER_TYPES_PATH = "/dashboard/inventory/supplier-types";
const initialState: InventoryCatalogFormState = { error: "" };

async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }

  return session;
}

function emptyToNull(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();
  return text ? text : null;
}

function getUniqueErrorMessage(error: unknown, message: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return message;
  }

  return "No se pudo guardar el tipo de proveedor. Intenta nuevamente.";
}

export async function createSupplierTypeAction(
  _prevState: InventoryCatalogFormState,
  formData: FormData,
): Promise<InventoryCatalogFormState> {
  const session = await requireAdmin();
  const parsed = inventoryCatalogSchema.safeParse({
    nombre: formData.get("nombre")?.toString(),
    slug: formData.get("slug")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
  });

  if (!parsed.success) {
    return {
      error: "Revisa los datos del tipo de proveedor.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const existingType = await prisma.tipo_proveedor_catalogo.findFirst({
    where: {
      OR: [{ nombre: data.nombre }, { slug: data.slug }],
    },
    select: {
      id_tipo_proveedor: true,
    },
  });

  if (existingType) {
    return {
      error: "Ya existe un tipo de proveedor con ese nombre o slug.",
      fieldErrors: {
        nombre: ["Ya existe un tipo de proveedor con ese nombre o slug."],
      },
    };
  }

  const lastType = await prisma.tipo_proveedor_catalogo.findFirst({
    orderBy: {
      id_tipo_proveedor: "desc",
    },
    select: {
      id_tipo_proveedor: true,
    },
  });

  const idTipoProveedor = buildNextId("TPR", lastType?.id_tipo_proveedor);

  try {
    await prisma.tipo_proveedor_catalogo.create({
      data: {
        id_tipo_proveedor: idTipoProveedor,
        nombre: data.nombre,
        slug: data.slug,
        descripcion: emptyToNull(formData.get("descripcion")),
        estado: true,
      },
    });
  } catch (error) {
    const errorMessage = getUniqueErrorMessage(
      error,
      "Ya existe un tipo de proveedor con ese nombre o slug.",
    );

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage === "Ya existe un tipo de proveedor con ese nombre o slug."
          ? { nombre: [errorMessage] }
          : undefined,
    };
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "tipo_proveedor_catalogo",
    id_registro_afectado: idTipoProveedor,
    accion: "crear",
    detalle: `Tipo de proveedor creado: ${data.nombre}`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(SUPPLIERS_PATH);
  revalidatePath(SUPPLIER_TYPES_PATH);

  return initialState;
}

export async function updateSupplierTypeAction(
  _prevState: InventoryCatalogFormState,
  formData: FormData,
): Promise<InventoryCatalogFormState> {
  const session = await requireAdmin();
  const idTipoProveedor = formData.get("id_tipo_proveedor")?.toString();

  if (!idTipoProveedor) {
    return {
      error: "El tipo de proveedor no existe.",
    };
  }

  const parsed = inventoryCatalogSchema.safeParse({
    nombre: formData.get("nombre")?.toString(),
    slug: formData.get("slug")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
  });

  if (!parsed.success) {
    return {
      error: "Revisa los datos del tipo de proveedor.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const existingType = await prisma.tipo_proveedor_catalogo.findFirst({
    where: {
      OR: [{ nombre: data.nombre }, { slug: data.slug }],
    },
    select: {
      id_tipo_proveedor: true,
    },
  });

  if (existingType && existingType.id_tipo_proveedor !== idTipoProveedor) {
    return {
      error: "Ya existe otro tipo de proveedor con ese nombre o slug.",
      fieldErrors: {
        nombre: ["Ya existe otro tipo de proveedor con ese nombre o slug."],
      },
    };
  }

  try {
    await prisma.tipo_proveedor_catalogo.update({
      where: {
        id_tipo_proveedor: idTipoProveedor,
      },
      data: {
        nombre: data.nombre,
        slug: data.slug,
        descripcion: emptyToNull(formData.get("descripcion")),
      },
    });
  } catch (error) {
    const errorMessage = getUniqueErrorMessage(
      error,
      "Ya existe otro tipo de proveedor con ese nombre o slug.",
    );

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage ===
        "Ya existe otro tipo de proveedor con ese nombre o slug."
          ? { nombre: [errorMessage] }
          : undefined,
    };
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "tipo_proveedor_catalogo",
    id_registro_afectado: idTipoProveedor,
    accion: "actualizar",
    detalle: `Tipo de proveedor actualizado: ${data.nombre}`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(SUPPLIERS_PATH);
  revalidatePath(SUPPLIER_TYPES_PATH);

  return initialState;
}

export async function toggleSupplierTypeStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const idTipoProveedor = formData.get("id_tipo_proveedor")?.toString();

  if (!idTipoProveedor) {
    redirect(SUPPLIER_TYPES_PATH);
  }

  const supplierType = await prisma.tipo_proveedor_catalogo.findUnique({
    where: {
      id_tipo_proveedor: idTipoProveedor,
    },
    select: {
      id_tipo_proveedor: true,
      nombre: true,
      estado: true,
    },
  });

  if (!supplierType) {
    redirect(SUPPLIER_TYPES_PATH);
  }

  const nextStatus = !supplierType.estado;

  await prisma.tipo_proveedor_catalogo.update({
    where: {
      id_tipo_proveedor: supplierType.id_tipo_proveedor,
    },
    data: {
      estado: nextStatus,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "tipo_proveedor_catalogo",
    id_registro_afectado: supplierType.id_tipo_proveedor,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Tipo de proveedor ${
      nextStatus ? "activado" : "inactivado"
    }: ${supplierType.nombre}`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(SUPPLIERS_PATH);
  revalidatePath(SUPPLIER_TYPES_PATH);
  redirect(SUPPLIER_TYPES_PATH);
}
