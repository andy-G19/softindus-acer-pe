"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildNextId } from "@/lib/ids";
import { expenseCategorySchema } from "@/schemas/petty-cash/expense-category.schema";

export type ExpenseCategoryFormState = {
  error: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

const EXPENSE_CATEGORIES_PATH = "/dashboard/petty-cash/categories";

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

function getCategoryFormData(formData: FormData) {
  return {
    nombre_categoria: formData.get("nombre_categoria"),
    descripcion: formData.get("descripcion") ?? "",
    estado: formData.get("estado") ?? "true",
  };
}

async function hasDuplicateCategory(name: string, currentCategoryId?: string) {
  const category = await prisma.categoria_gasto.findFirst({
    where: {
      nombre_categoria: {
        equals: name,
        mode: "insensitive",
      },
    },
    select: {
      id_categoria_gasto: true,
    },
  });

  if (!category) {
    return false;
  }

  return category.id_categoria_gasto !== currentCategoryId;
}

function getPrismaErrorMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Ya existe una categoria de gasto con ese nombre.";
  }

  return "No se pudo guardar la categoria de gasto. Intenta nuevamente.";
}

export async function createExpenseCategoryAction(
  _prevState: ExpenseCategoryFormState,
  formData: FormData,
): Promise<ExpenseCategoryFormState> {
  const session = await requireAdmin();
  const parsed = expenseCategorySchema.safeParse(getCategoryFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la categoria.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const categoryName = data.nombre_categoria.trim();

  if (await hasDuplicateCategory(categoryName)) {
    return {
      error: "Ya existe una categoria de gasto con ese nombre.",
      fieldErrors: {
        nombre_categoria: [
          "Ya existe una categoria de gasto con ese nombre.",
        ],
      },
    };
  }

  const lastCategory = await prisma.categoria_gasto.findFirst({
    orderBy: {
      id_categoria_gasto: "desc",
    },
    select: {
      id_categoria_gasto: true,
    },
  });

  const idCategoriaGasto = buildNextId(
    "CGA",
    lastCategory?.id_categoria_gasto,
  );

  try {
    await prisma.categoria_gasto.create({
      data: {
        id_categoria_gasto: idCategoriaGasto,
        nombre_categoria: categoryName,
        descripcion: data.descripcion || null,
        estado: data.estado === "true",
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "categoria_gasto",
      id_registro_afectado: idCategoriaGasto,
      accion: "crear",
      detalle: `Categoria de gasto creada: ${categoryName}`,
    });
  } catch (error) {
    return { error: getPrismaErrorMessage(error) };
  }

  revalidatePath("/dashboard/petty-cash");
  revalidatePath(EXPENSE_CATEGORIES_PATH);

  redirect(EXPENSE_CATEGORIES_PATH);
}

export async function updateExpenseCategoryAction(
  _prevState: ExpenseCategoryFormState,
  formData: FormData,
): Promise<ExpenseCategoryFormState> {
  const session = await requireAdmin();
  const categoryId = formData.get("id_categoria_gasto")?.toString().trim();

  if (!categoryId) {
    return { error: "La categoria de gasto no existe." };
  }

  const currentCategory = await prisma.categoria_gasto.findUnique({
    where: {
      id_categoria_gasto: categoryId,
    },
    select: {
      id_categoria_gasto: true,
    },
  });

  if (!currentCategory) {
    return { error: "La categoria de gasto no existe." };
  }

  const parsed = expenseCategorySchema.safeParse(getCategoryFormData(formData));

  if (!parsed.success) {
    return {
      error: "Revisa los datos de la categoria.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const data = parsed.data;
  const categoryName = data.nombre_categoria.trim();

  if (await hasDuplicateCategory(categoryName, categoryId)) {
    return {
      error: "Ya existe otra categoria de gasto con ese nombre.",
      fieldErrors: {
        nombre_categoria: [
          "Ya existe otra categoria de gasto con ese nombre.",
        ],
      },
    };
  }

  try {
    await prisma.categoria_gasto.update({
      where: {
        id_categoria_gasto: categoryId,
      },
      data: {
        nombre_categoria: categoryName,
        descripcion: data.descripcion || null,
        estado: data.estado === "true",
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "categoria_gasto",
      id_registro_afectado: categoryId,
      accion: "actualizar",
      detalle: `Categoria de gasto actualizada: ${categoryName}`,
    });
  } catch (error) {
    return { error: getPrismaErrorMessage(error) };
  }

  revalidatePath("/dashboard/petty-cash");
  revalidatePath(EXPENSE_CATEGORIES_PATH);

  redirect(EXPENSE_CATEGORIES_PATH);
}

export async function toggleExpenseCategoryStatusAction(formData: FormData) {
  const session = await requireAdmin();
  const categoryId = formData.get("id_categoria_gasto")?.toString().trim();

  if (!categoryId) {
    redirect(EXPENSE_CATEGORIES_PATH);
  }

  const category = await prisma.categoria_gasto.findUnique({
    where: {
      id_categoria_gasto: categoryId,
    },
    select: {
      nombre_categoria: true,
      estado: true,
    },
  });

  if (!category) {
    redirect(EXPENSE_CATEGORIES_PATH);
  }

  const nextStatus = !category.estado;

  await prisma.categoria_gasto.update({
    where: {
      id_categoria_gasto: categoryId,
    },
    data: {
      estado: nextStatus,
    },
  });

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "categoria_gasto",
    id_registro_afectado: categoryId,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Categoria de gasto ${
      nextStatus ? "activada" : "inactivada"
    }: ${category.nombre_categoria}`,
  });

  revalidatePath("/dashboard/petty-cash");
  revalidatePath(EXPENSE_CATEGORIES_PATH);

  redirect(EXPENSE_CATEGORIES_PATH);
}
