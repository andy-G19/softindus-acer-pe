"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { newOperationId, type FormActionState } from "@/lib/action-result";
import { registerAuditLog } from "@/lib/audit";
import { getAuthorizedSession } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import type { FieldErrors } from "@/lib/errors";
import {
  parseRequestedStatus,
  statusToggleDone,
  statusToggleError,
  type StatusToggleState,
} from "@/lib/requested-status";
import { expenseCategorySchema } from "@/schemas/petty-cash/expense-category.schema";

/** Lo que el formulario de categoria de gasto envio, tal cual, para volver a mostrarlo. */
export type ExpenseCategoryFormValues = {
  nombre_categoria: string;
  descripcion: string;
};

// Entrega 10: el alta y la edicion se usan desde una ventana modal (y la
// edicion tambien desde su pagina) y devuelven el resultado en lugar de
// redirigir; sin permiso responden con un error. El formulario ya no tiene
// el campo Estado: las categorias nacen activas y el estado solo cambia desde
// la fila, con confirmacion y con "inactivar" en la bitacora.
export type ExpenseCategoryFormState = FormActionState<
  ExpenseCategoryFormValues,
  { id_categoria_gasto: string }
>;

const EXPENSE_CATEGORIES_PATH = "/dashboard/petty-cash/categories";
const PERMISSION_ERROR = "No tienes permisos para gestionar categorías de gasto.";

function getCategoryFormValues(formData: FormData): ExpenseCategoryFormValues {
  return {
    nombre_categoria: formData.get("nombre_categoria")?.toString() ?? "",
    descripcion: formData.get("descripcion")?.toString() ?? "",
  };
}

function categoryError(
  values: ExpenseCategoryFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): ExpenseCategoryFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

function categorySaved(values: ExpenseCategoryFormValues, idCategoriaGasto: string): ExpenseCategoryFormState {
  return {
    status: "success",
    data: { id_categoria_gasto: idCategoriaGasto },
    values,
    operationId: newOperationId(),
  };
}

function getCategoryFormData(formData: FormData) {
  return {
    nombre_categoria: formData.get("nombre_categoria"),
    descripcion: formData.get("descripcion") ?? "",
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
  const values = getCategoryFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return categoryError(values, PERMISSION_ERROR);
  }

  const parsed = expenseCategorySchema.safeParse(getCategoryFormData(formData));

  if (!parsed.success) {
    return categoryError(values, "Revisa los datos de la categoria.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const categoryName = data.nombre_categoria.trim();

  if (await hasDuplicateCategory(categoryName)) {
    return categoryError(values, "Ya existe una categoria de gasto con ese nombre.", {
      nombre_categoria: ["Ya existe una categoria de gasto con ese nombre."],
    });
  }

  let idCategoriaGasto: string;

  try {
    idCategoriaGasto = await prisma.$transaction(async (tx) => {
      const idNuevo = await getNextCorrelativeId(tx, {
        codigoEntidad: "categoria_gasto",
        prefijo: "CGA",
      });

      await tx.categoria_gasto.create({
        data: {
          id_categoria_gasto: idNuevo,
          nombre_categoria: categoryName,
          descripcion: data.descripcion || null,
          estado: true,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "categoria_gasto",
        id_registro_afectado: idNuevo,
        accion: "crear",
        detalle: `Categoria de gasto creada: ${categoryName}`,
        tx,
      });

      return idNuevo;
    });
  } catch (error) {
    return categoryError(values, getPrismaErrorMessage(error));
  }

  revalidatePath("/dashboard/petty-cash");
  revalidatePath(EXPENSE_CATEGORIES_PATH);

  return categorySaved(values, idCategoriaGasto);
}

export async function updateExpenseCategoryAction(
  _prevState: ExpenseCategoryFormState,
  formData: FormData,
): Promise<ExpenseCategoryFormState> {
  const values = getCategoryFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return categoryError(values, PERMISSION_ERROR);
  }

  const categoryId = formData.get("id_categoria_gasto")?.toString().trim();

  if (!categoryId) {
    return categoryError(values, "La categoria de gasto no existe.");
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
    return categoryError(values, "La categoria de gasto no existe.");
  }

  const parsed = expenseCategorySchema.safeParse(getCategoryFormData(formData));

  if (!parsed.success) {
    return categoryError(values, "Revisa los datos de la categoria.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  const categoryName = data.nombre_categoria.trim();

  if (await hasDuplicateCategory(categoryName, categoryId)) {
    return categoryError(values, "Ya existe otra categoria de gasto con ese nombre.", {
      nombre_categoria: ["Ya existe otra categoria de gasto con ese nombre."],
    });
  }

  try {
    await prisma.categoria_gasto.update({
      where: {
        id_categoria_gasto: categoryId,
      },
      data: {
        nombre_categoria: categoryName,
        descripcion: data.descripcion || null,
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
    return categoryError(values, getPrismaErrorMessage(error));
  }

  revalidatePath("/dashboard/petty-cash");
  revalidatePath(EXPENSE_CATEGORIES_PATH);

  return categorySaved(values, categoryId);
}

// Activar e inactivar desde la fila (entrega 10): devuelven el resultado para
// ConfirmActionButton en lugar de redirigir con ?toast=, y sin permiso
// responden con un error.
export async function toggleExpenseCategoryStatusAction(
  _prevState: StatusToggleState,
  formData: FormData,
): Promise<StatusToggleState> {
  const categoryId = formData.get("id_categoria_gasto")?.toString().trim() ?? "";
  const session = await getAuthorizedSession(["ADMIN"]);

  if (!session) {
    return statusToggleError(categoryId, PERMISSION_ERROR);
  }

  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!categoryId) {
    return statusToggleError(categoryId, "La categoria de gasto no existe.");
  }

  if (nextStatus === null) {
    return statusToggleError(categoryId, "Estado no válido.");
  }

  // Fija el estado pedido solo si la categoria tiene el contrario: comparar y
  // escribir en una sola sentencia evita que una lista desactualizada o un
  // doble clic hagan lo contrario de lo que dice el boton.
  const { count } = await prisma.categoria_gasto.updateMany({
    where: {
      id_categoria_gasto: categoryId,
      estado: !nextStatus,
    },
    data: {
      estado: nextStatus,
    },
  });

  const category = await prisma.categoria_gasto.findUnique({
    where: {
      id_categoria_gasto: categoryId,
    },
    select: {
      nombre_categoria: true,
    },
  });

  // count 0: no existe o ya tenia ese estado; no hay nada que registrar.
  if (count === 0) {
    return statusToggleError(
      categoryId,
      category
        ? `La categoría de gasto ya estaba ${nextStatus ? "activa" : "inactiva"}.`
        : "La categoria de gasto no existe.",
    );
  }

  await registerAuditLog({
    userId: session.user.id,
    entidad_afectada: "categoria_gasto",
    id_registro_afectado: categoryId,
    accion: nextStatus ? "activar" : "inactivar",
    detalle: `Categoria de gasto ${
      nextStatus ? "activada" : "inactivada"
    }: ${category?.nombre_categoria ?? categoryId}`,
  });

  revalidatePath("/dashboard/petty-cash");
  revalidatePath(EXPENSE_CATEGORIES_PATH);

  return statusToggleDone(categoryId, nextStatus);
}
