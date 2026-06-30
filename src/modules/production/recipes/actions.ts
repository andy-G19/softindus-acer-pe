"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { technicalRecipeSchema } from "@/schemas/production/recipe.schema";

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

function requireProductionManager(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export async function createTechnicalRecipeAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = technicalRecipeSchema.safeParse({
    id_producto: formData.get("id_producto"),
    nombre_receta: formData.get("nombre_receta"),
    descripcion: formData.get("descripcion") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const product = await prisma.producto.findFirst({
    where: {
      id_producto: data.id_producto,
      estado: true,
    },
    select: {
      id_producto: true,
      nombre_producto: true,
    },
  });

  if (!product) {
    throw new Error("El producto seleccionado no existe o está inactivo.");
  }

  const duplicatedRecipe = await prisma.receta_tecnica.findFirst({
    where: {
      id_producto: data.id_producto,
      nombre_receta: data.nombre_receta,
    },
  });

  if (duplicatedRecipe) {
    throw new Error("Ya existe una receta con ese nombre para este producto.");
  }

  const lastRecipe = await prisma.receta_tecnica.findFirst({
    orderBy: {
      id_receta: "desc",
    },
    select: {
      id_receta: true,
    },
  });

  const idReceta = buildSequentialId(lastRecipe?.id_receta, "REC");

  await prisma.receta_tecnica.create({
    data: {
      id_receta: idReceta,
      id_producto: data.id_producto,
      nombre_receta: data.nombre_receta,
      descripcion: data.descripcion,
      estado: "activa",
      id_usuario_creacion: session.user.id,
    },
  });

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/recipes");

  redirect("/dashboard/production/recipes");
}

export async function toggleTechnicalRecipeStatusAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const idReceta = String(formData.get("id_receta") ?? "");

  if (!idReceta) {
    throw new Error("No se recibió la receta técnica.");
  }

  const recipe = await prisma.receta_tecnica.findUnique({
    where: {
      id_receta: idReceta,
    },
    select: {
      id_receta: true,
      estado: true,
    },
  });

  if (!recipe) {
    throw new Error("La receta técnica seleccionada no existe.");
  }

  const nextStatus = recipe.estado === "activa" ? "inactiva" : "activa";

  await prisma.receta_tecnica.update({
    where: {
      id_receta: idReceta,
    },
    data: {
      estado: nextStatus,
    },
  });

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/recipes");

  redirect("/dashboard/production/recipes");
}