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
const MATERIALS_PATH = "/dashboard/inventory/materials";
const MATERIAL_CATEGORIES_PATH = "/dashboard/inventory/material-categories";
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

  return "No se pudo guardar la categoría. Intenta nuevamente.";
}

export async function createMaterialCategoryAction(
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
      error: "Revisa los datos de la categoría.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
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
    return {
      error: "Ya existe una categoría de material con ese nombre o slug.",
      fieldErrors: {
        nombre: ["Ya existe una categoría de material con ese nombre o slug."],
      },
    };
  }

  const lastCategory = await prisma.categoria_material.findFirst({
    orderBy: {
      id_categoria_material: "desc",
    },
    select: {
      id_categoria_material: true,
    },
  });

  const idCategoriaMaterial = buildNextId(
    "CMA",
    lastCategory?.id_categoria_material,
  );

  try {
    await prisma.categoria_material.create({
      data: {
        id_categoria_material: idCategoriaMaterial,
        nombre: data.nombre,
        slug: data.slug,
        descripcion: emptyToNull(formData.get("descripcion")),
        estado: true,
      },
    });
  } catch (error) {
    const errorMessage = getUniqueErrorMessage(
      error,
      "Ya existe una categoría de material con ese nombre o slug.",
    );

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage ===
        "Ya existe una categoría de material con ese nombre o slug."
          ? { nombre: [errorMessage] }
          : undefined,
    };
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "categoria_material",
    id_registro_afectado: idCategoriaMaterial,
    accion: "crear",
    detalle: `Categoría de material creada: ${data.nombre}`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(MATERIALS_PATH);
  revalidatePath(MATERIAL_CATEGORIES_PATH);

  return initialState;
}

export async function updateMaterialCategoryAction(
  _prevState: InventoryCatalogFormState,
  formData: FormData,
): Promise<InventoryCatalogFormState> {
  const session = await requireAdmin();
  const idCategoriaMaterial = formData
    .get("id_categoria_material")
    ?.toString();

  if (!idCategoriaMaterial) {
    return {
      error: "La categoría no existe.",
    };
  }

  const parsed = inventoryCatalogSchema.safeParse({
    nombre: formData.get("nombre")?.toString(),
    slug: formData.get("slug")?.toString(),
    descripcion: formData.get("descripcion")?.toString() ?? "",
  });

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la categoría.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
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
    return {
      error: "Ya existe otra categoría de material con ese nombre o slug.",
      fieldErrors: {
        nombre: [
          "Ya existe otra categoría de material con ese nombre o slug.",
        ],
      },
    };
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

    return {
      error: errorMessage,
      fieldErrors:
        errorMessage ===
        "Ya existe otra categoría de material con ese nombre o slug."
          ? { nombre: [errorMessage] }
          : undefined,
    };
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

  return initialState;
}

export async function toggleMaterialCategoryStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const idCategoriaMaterial = formData
    .get("id_categoria_material")
    ?.toString();

  if (!idCategoriaMaterial) {
    redirect(MATERIAL_CATEGORIES_PATH);
  }

  const category = await prisma.categoria_material.findUnique({
    where: {
      id_categoria_material: idCategoriaMaterial,
    },
    select: {
      id_categoria_material: true,
      nombre: true,
      estado: true,
    },
  });

  if (!category) {
    redirect(MATERIAL_CATEGORIES_PATH);
  }

  const nextStatus = !category.estado;

  await prisma.categoria_material.update({
    where: {
      id_categoria_material: category.id_categoria_material,
    },
    data: {
      estado: nextStatus,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "categoria_material",
    id_registro_afectado: category.id_categoria_material,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Categoría de material ${
      nextStatus ? "activada" : "inactivada"
    }: ${category.nombre}`,
  });

  revalidatePath(INVENTORY_PATH);
  revalidatePath(MATERIALS_PATH);
  revalidatePath(MATERIAL_CATEGORIES_PATH);
  redirect(MATERIAL_CATEGORIES_PATH);
}
