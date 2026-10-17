"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import {
  parseRequestedStatus,
  statusToggleDone,
  statusToggleError,
  type StatusToggleState,
} from "@/lib/requested-status";
import {
  catalogError,
  catalogSaved,
  getCatalogFormValues,
  type InventoryCatalogFormState,
} from "@/modules/inventory/catalog-form-state";
import { inventoryCatalogSchema } from "@/schemas/inventory/catalog.schema";

const INVENTORY_PATH = "/dashboard/inventory";
const MATERIALS_PATH = "/dashboard/inventory/materials";
const MATERIAL_CATEGORIES_PATH = "/dashboard/inventory/material-categories";
const PERMISSION_ERROR = "No tienes permisos para gestionar categorías de material.";

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

  return "No se pudo guardar la categoría. Intenta nuevamente.";
}

// Entrega 10: el alta y la edicion se usan desde una ventana modal y
// devuelven el resultado (FormActionState); sin permiso responden con un
// error en lugar de redirigir.
export async function createMaterialCategoryAction(
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
    return catalogError(values, "Revisa los datos de la categoría.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const existingCategory = await prisma.categoria_material.findFirst({
    where: {
      OR: [{ nombre: data.nombre }, { slug: data.slug }],
    },
    select: {
      id_categoria_material: true,
    },
  });

  if (existingCategory) {
    return catalogError(values, "Ya existe una categoría de material con ese nombre o slug.", {
      nombre: ["Ya existe una categoría de material con ese nombre o slug."],
    });
  }

  let idCategoriaMaterial: string;

  try {
    idCategoriaMaterial = await prisma.$transaction(async (tx) => {
      const idNuevo = await getNextCorrelativeId(tx, {
        codigoEntidad: "categoria_material",
        prefijo: "CMA",
      });

      await tx.categoria_material.create({
        data: {
          id_categoria_material: idNuevo,
          nombre: data.nombre,
          slug: data.slug,
          descripcion: emptyToNull(formData.get("descripcion")),
          estado: true,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "categoria_material",
        id_registro_afectado: idNuevo,
        accion: "crear",
        detalle: `Categoría de material creada: ${data.nombre}`,
        tx,
      });

      return idNuevo;
    });
  } catch (error) {
    const errorMessage = getUniqueErrorMessage(
      error,
      "Ya existe una categoría de material con ese nombre o slug.",
    );

    return catalogError(
      values,
      errorMessage,
      errorMessage === "Ya existe una categoría de material con ese nombre o slug."
        ? { nombre: [errorMessage] }
        : undefined,
    );
  }

  revalidatePath(INVENTORY_PATH);
  revalidatePath(MATERIALS_PATH);
  revalidatePath(MATERIAL_CATEGORIES_PATH);

  return catalogSaved(values, idCategoriaMaterial);
}

export async function updateMaterialCategoryAction(
  _prevState: InventoryCatalogFormState,
  formData: FormData,
): Promise<InventoryCatalogFormState> {
  const values = getCatalogFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return catalogError(values, PERMISSION_ERROR);
  }

  const idCategoriaMaterial = formData
    .get("id_categoria_material")
    ?.toString();

  if (!idCategoriaMaterial) {
    return catalogError(values, "La categoría no existe.");
  }

  const parsed = inventoryCatalogSchema.safeParse({
    nombre: formData.get("nombre")?.toString(),
    slug: formData.get("slug")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
  });

  if (!parsed.success) {
    return catalogError(values, "Revisa los datos de la categoría.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const existingCategory = await prisma.categoria_material.findFirst({
    where: {
      OR: [{ nombre: data.nombre }, { slug: data.slug }],
    },
    select: {
      id_categoria_material: true,
    },
  });

  if (
    existingCategory &&
    existingCategory.id_categoria_material !== idCategoriaMaterial
  ) {
    return catalogError(values, "Ya existe otra categoría de material con ese nombre o slug.", {
      nombre: ["Ya existe otra categoría de material con ese nombre o slug."],
    });
  }

  try {
    await prisma.categoria_material.update({
      where: {
        id_categoria_material: idCategoriaMaterial,
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
      "Ya existe otra categoría de material con ese nombre o slug.",
    );

    return catalogError(
      values,
      errorMessage,
      errorMessage === "Ya existe otra categoría de material con ese nombre o slug."
        ? { nombre: [errorMessage] }
        : undefined,
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "categoria_material",
    id_registro_afectado: idCategoriaMaterial,
    accion: "actualizar",
    detalle: `Categoría de material actualizada: ${data.nombre}`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(MATERIALS_PATH);
  revalidatePath(MATERIAL_CATEGORIES_PATH);

  return catalogSaved(values, idCategoriaMaterial);
}

// Activar e inactivar desde la fila (entrega 10): devuelven el resultado para
// ConfirmActionButton en lugar de redirigir con ?toast=, y sin permiso
// responden con un error.
export async function toggleMaterialCategoryStatusAction(
  _prevState: StatusToggleState,
  formData: FormData,
): Promise<StatusToggleState> {
  const idCategoriaMaterial = formData
    .get("id_categoria_material")
    ?.toString() ?? "";
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return statusToggleError(idCategoriaMaterial, PERMISSION_ERROR);
  }

  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!idCategoriaMaterial) {
    return statusToggleError(idCategoriaMaterial, "La categoría no existe.");
  }

  if (nextStatus === null) {
    return statusToggleError(idCategoriaMaterial, "Estado no válido.");
  }

  // Fija el estado pedido solo si el registro tiene el contrario: comparar y
  // escribir en una sola sentencia evita que una lista desactualizada o un
  // doble clic hagan lo contrario de lo que dice el boton.
  const { count } = await prisma.categoria_material.updateMany({
    where: {
      id_categoria_material: idCategoriaMaterial,
      estado: !nextStatus,
    },
    data: {
      estado: nextStatus,
    },
  });

  const category = await prisma.categoria_material.findUnique({
    where: {
      id_categoria_material: idCategoriaMaterial,
    },
    select: {
      nombre: true,
    },
  });

  // count 0: no existe o ya tenia ese estado; no hay nada que registrar.
  if (count === 0) {
    return statusToggleError(
      idCategoriaMaterial,
      category
        ? `La categoría de material ya estaba ${nextStatus ? "activa" : "inactiva"}.`
        : "La categoría no existe.",
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "categoria_material",
    id_registro_afectado: idCategoriaMaterial,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Categoría de material ${
      nextStatus ? "activada" : "inactivada"
    }: ${category?.nombre ?? idCategoriaMaterial}`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(MATERIALS_PATH);
  revalidatePath(MATERIAL_CATEGORIES_PATH);

  return statusToggleDone(idCategoriaMaterial, nextStatus);
}
