"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { expenseCategorySchema } from "@/schemas/petty-cash/expense-category.schema";

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

function requireAdmin(role: string | undefined) {
  if (role !== "ADMIN") {
    redirect("/dashboard/access-denied");
  }
}

export async function createExpenseCategoryAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireAdmin(session.user.role);

  const parsedData = expenseCategorySchema.safeParse({
    nombre_categoria: formData.get("nombre_categoria"),
    descripcion: formData.get("descripcion"),
    estado: formData.get("estado") ?? "true",
  });

  if (!parsedData.success) {
    const message = parsedData.error.issues
      .map((issue) => issue.message)
      .join(" ");

    throw new Error(message);
  }

  const data = parsedData.data;
  const categoryName = data.nombre_categoria.trim();

  const existingCategory = await prisma.categoria_gasto.findFirst({
    where: {
      nombre_categoria: {
        equals: categoryName,
        mode: "insensitive",
      },
    },
  });

  if (existingCategory) {
    throw new Error("Ya existe una categoría de gasto con ese nombre.");
  }

  const lastCategory = await prisma.categoria_gasto.findFirst({
    orderBy: {
      id_categoria_gasto: "desc",
    },
    select: {
      id_categoria_gasto: true,
    },
  });

  const idCategoriaGasto = buildSequentialId(
    lastCategory?.id_categoria_gasto,
    "CGA",
  );

  await prisma.categoria_gasto.create({
    data: {
      id_categoria_gasto: idCategoriaGasto,
      nombre_categoria: categoryName,
      descripcion: data.descripcion || null,
      estado: data.estado === "true",
    },
  });

  revalidatePath("/dashboard/petty-cash");
  revalidatePath("/dashboard/petty-cash/categories");

  redirect("/dashboard/petty-cash/categories");
}