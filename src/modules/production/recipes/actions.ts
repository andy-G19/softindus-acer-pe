"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { registerAuditLog } from "@/lib/audit";
import { requireRole } from "@/lib/authz";
import { getNextCorrelativeId } from "@/lib/correlatives";
import { prisma } from "@/lib/db";
import { lockRecipeRow } from "@/lib/row-locks";
import { technicalRecipeSchema } from "@/schemas/production/recipe.schema";

const DUPLICATED_RECIPE = "Ya existe una receta con ese nombre para este producto.";

export async function createTechnicalRecipeAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const parsed = technicalRecipeSchema.safeParse({
    id_producto: formData.get("id_producto"),
    nombre_receta: formData.get("nombre_receta"),
    descripcion: formData.get("descripcion") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }

  const data = parsed.data;

  let problem: string | null;

  try {
    // Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
    problem = await prisma.$transaction(async (tx): Promise<string | null> => {
      const product = await tx.producto.findFirst({
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
        return "El producto seleccionado no existe o está inactivo.";
      }

      const duplicatedRecipe = await tx.receta_tecnica.findFirst({
        where: {
          id_producto: data.id_producto,
          nombre_receta: data.nombre_receta,
        },
      });

      if (duplicatedRecipe) {
        return DUPLICATED_RECIPE;
      }

      const idReceta = await getNextCorrelativeId(tx, {
        codigoEntidad: "receta_tecnica",
        prefijo: "REC",
      });

      await tx.receta_tecnica.create({
        data: {
          id_receta: idReceta,
          id_producto: data.id_producto,
          nombre_receta: data.nombre_receta,
          descripcion: data.descripcion,
          estado: "activa",
          id_usuario_creacion: session.user.id,
        },
      });

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "receta_tecnica",
        id_registro_afectado: idReceta,
        accion: "CREAR_RECETA",
        detalle: `Receta técnica creada para el producto ${product.nombre_producto}.`,
        tx,
      });

      return null;
    });
  } catch (error) {
    // Una carrera por el nombre llega como violacion de uq_receta_producto_nombre:
    // al crear no hay fila que bloquear.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(DUPLICATED_RECIPE);
    }

    throw error;
  }

  if (problem) {
    throw new Error(problem);
  }

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/recipes");

  redirect("/dashboard/production/recipes?toast=recipe-created");
}

export async function toggleTechnicalRecipeStatusAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const idReceta = String(formData.get("id_receta") ?? "");

  if (!idReceta) {
    throw new Error("No se recibió la receta técnica.");
  }

  const nextStatus = await prisma.$transaction(async (tx) => {
    await lockRecipeRow(tx, idReceta);

    const recipe = await tx.receta_tecnica.findUnique({
      where: {
        id_receta: idReceta,
      },
      select: {
        id_receta: true,
        estado: true,
      },
    });

    if (!recipe) {
      return null;
    }

    const estado = recipe.estado === "activa" ? "inactiva" : "activa";

    await tx.receta_tecnica.update({
      where: {
        id_receta: idReceta,
      },
      data: {
        estado,
      },
    });

    await registerAuditLog({
      userId: session.user.id,
      entidad_afectada: "receta_tecnica",
      id_registro_afectado: idReceta,
      accion: "ACTUALIZAR_RECETA",
      detalle: `Estado de receta técnica cambiado a ${estado}.`,
      tx,
    });

    return estado;
  });

  if (!nextStatus) {
    throw new Error("La receta técnica seleccionada no existe.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/recipes");

  redirect(
    `/dashboard/production/recipes?toast=${nextStatus === "activa" ? "recipe-activated" : "recipe-deactivated"}`,
  );
}
