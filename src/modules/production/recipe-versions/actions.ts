"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { recipeVersionSchema } from "@/schemas/production/recipe-version.schema";

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
    redirect("/access-denied");
  }
}

export async function createRecipeVersionAction(formData: FormData) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionManager(session.user.role);

  const parsed = recipeVersionSchema.safeParse({
    id_receta: formData.get("id_receta"),
    numero_version: formData.get("numero_version"),
    motivo_cambio: formData.get("motivo_cambio") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  const recipe = await prisma.receta_tecnica.findFirst({
    where: {
      id_receta: data.id_receta,
      estado: "activa",
    },
    include: {
      version_receta: true,
    },
  });

  if (!recipe) {
    throw new Error("La receta técnica no existe o está inactiva.");
  }

  if (recipe.version_receta) {
    throw new Error("Esta receta ya tiene una versión registrada.");
  }

  const duplicatedVersionNumber = await prisma.version_receta.findFirst({
    where: {
      id_receta: data.id_receta,
      numero_version: data.numero_version,
    },
  });

  if (duplicatedVersionNumber) {
    throw new Error("Ya existe una versión con ese número para esta receta.");
  }

  const lastVersion = await prisma.version_receta.findFirst({
    orderBy: {
      id_version_receta: "desc",
    },
    select: {
      id_version_receta: true,
    },
  });

  const idVersionReceta = buildSequentialId(
    lastVersion?.id_version_receta,
    "VER",
  );

  await prisma.version_receta.create({
    data: {
      id_version_receta: idVersionReceta,
      id_receta: data.id_receta,
      numero_version: data.numero_version,
      motivo_cambio: data.motivo_cambio,
      estado: "vigente",
      id_usuario_aprueba: session.user.id,
    },
  });

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/recipes");
  revalidatePath(`/dashboard/production/recipes/${data.id_receta}/versions`);

  redirect(`/dashboard/production/recipes/${data.id_receta}/versions`);
}