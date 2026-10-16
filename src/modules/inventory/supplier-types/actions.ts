"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession, requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { parseRequestedStatus } from "@/lib/requested-status";
import {
  catalogError,
  catalogSaved,
  getCatalogFormValues,
  type InventoryCatalogFormState,
} from "@/modules/inventory/catalog-form-state";
import { inventoryCatalogSchema } from "@/schemas/inventory/catalog.schema";

const INVENTORY_PATH = "/dashboard/inventory";
const SUPPLIERS_PATH = "/dashboard/inventory/suppliers";
const SUPPLIER_TYPES_PATH = "/dashboard/inventory/supplier-types";
const PERMISSION_ERROR = "No tienes permisos para gestionar tipos de proveedor.";

async function requireAdmin() {
  return requireRole(["ADMIN"]);
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

// Entrega 10: el alta y la edicion se usan desde una ventana modal y
// devuelven el resultado (FormActionState); sin permiso responden con un
// error en lugar de redirigir.
export async function createSupplierTypeAction(
  _prevState: InventoryCatalogFormState,
  formData: FormData,
): Promise<InventoryCatalogFormState> {
  const values = getCatalogFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return catalogError(values, PERMISSION_ERROR);
  }

  const parsed = inventoryCatalogSchema.safeParse({
    nombre: formData.get("nombre")?.toString(),
    slug: formData.get("slug")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
  });

  if (!parsed.success) {
    return catalogError(values, "Revisa los datos del tipo de proveedor.", parsed.error.flatten().fieldErrors);
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
    return catalogError(values, "Ya existe un tipo de proveedor con ese nombre o slug.", {
      nombre: ["Ya existe un tipo de proveedor con ese nombre o slug."],
    });
  }

  let idTipoProveedor: string;

  try {
    idTipoProveedor = await prisma.$transaction(async (tx) => {
      const idNuevo = await getNextCorrelativeId(tx, {
        codigoEntidad: "tipo_proveedor_catalogo",
        prefijo: "TPR",
      });

      await tx.tipo_proveedor_catalogo.create({
        data: {
          id_tipo_proveedor: idNuevo,
          nombre: data.nombre,
          slug: data.slug,
          descripcion: emptyToNull(formData.get("descripcion")),
          estado: true,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "tipo_proveedor_catalogo",
        id_registro_afectado: idNuevo,
        accion: "crear",
        detalle: `Tipo de proveedor creado: ${data.nombre}`,
        tx,
      });

      return idNuevo;
    });
  } catch (error) {
    const errorMessage = getUniqueErrorMessage(
      error,
      "Ya existe un tipo de proveedor con ese nombre o slug.",
    );

    return catalogError(
      values,
      errorMessage,
      errorMessage === "Ya existe un tipo de proveedor con ese nombre o slug."
        ? { nombre: [errorMessage] }
        : undefined,
    );
  }

  revalidatePath(INVENTORY_PATH);
  revalidatePath(SUPPLIERS_PATH);
  revalidatePath(SUPPLIER_TYPES_PATH);

  return catalogSaved(values, idTipoProveedor);
}

export async function updateSupplierTypeAction(
  _prevState: InventoryCatalogFormState,
  formData: FormData,
): Promise<InventoryCatalogFormState> {
  const values = getCatalogFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return catalogError(values, PERMISSION_ERROR);
  }

  const idTipoProveedor = formData.get("id_tipo_proveedor")?.toString();

  if (!idTipoProveedor) {
    return catalogError(values, "El tipo de proveedor no existe.");
  }

  const parsed = inventoryCatalogSchema.safeParse({
    nombre: formData.get("nombre")?.toString(),
    slug: formData.get("slug")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
  });

  if (!parsed.success) {
    return catalogError(values, "Revisa los datos del tipo de proveedor.", parsed.error.flatten().fieldErrors);
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
    return catalogError(values, "Ya existe otro tipo de proveedor con ese nombre o slug.", {
      nombre: ["Ya existe otro tipo de proveedor con ese nombre o slug."],
    });
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

    return catalogError(
      values,
      errorMessage,
      errorMessage === "Ya existe otro tipo de proveedor con ese nombre o slug."
        ? { nombre: [errorMessage] }
        : undefined,
    );
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

  return catalogSaved(values, idTipoProveedor);
}

export async function toggleSupplierTypeStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const idTipoProveedor = formData.get("id_tipo_proveedor")?.toString();
  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!idTipoProveedor || nextStatus === null) {
    redirect(SUPPLIER_TYPES_PATH);
  }

  // Fija el estado pedido solo si el registro tiene el contrario: comparar y
  // escribir en una sola sentencia evita que una lista desactualizada o un
  // doble clic hagan lo contrario de lo que dice el boton. count 0: no existe
  // o ya tenia ese estado, y no hay nada que registrar.
  const { count } = await prisma.tipo_proveedor_catalogo.updateMany({
    where: {
      id_tipo_proveedor: idTipoProveedor,
      estado: !nextStatus,
    },
    data: {
      estado: nextStatus,
    },
  });

  if (count === 0) {
    redirect(SUPPLIER_TYPES_PATH);
  }

  const supplierType = await prisma.tipo_proveedor_catalogo.findUnique({
    where: {
      id_tipo_proveedor: idTipoProveedor,
    },
    select: {
      nombre: true,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "tipo_proveedor_catalogo",
    id_registro_afectado: idTipoProveedor,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Tipo de proveedor ${
      nextStatus ? "activado" : "inactivado"
    }: ${supplierType?.nombre ?? idTipoProveedor}`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(SUPPLIERS_PATH);
  revalidatePath(SUPPLIER_TYPES_PATH);
  redirect(
    `${SUPPLIER_TYPES_PATH}?toast=${nextStatus ? "supplier-type-activated" : "supplier-type-deactivated"}`,
  );
}
