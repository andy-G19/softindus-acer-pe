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
import { technicalRecipeSchema } from "@/schemas/production/recipe.schema";

/** Lo que el formulario de receta envio, tal cual, para volver a mostrarlo. */
export type TechnicalRecipeFormValues = {
  id_producto: string;
  nombre_receta: string;
  descripcion: string;
};

// Entrega 10.6b: el alta se usa desde el panel lateral y devuelve el resultado; sin
// permiso responde con un error, no redirige.
export type TechnicalRecipeFormState = FormActionState<TechnicalRecipeFormValues, { id_receta: string }>;

type RecipeProblem = { error: string; fieldErrors?: FieldErrors };

const DUPLICATED_RECIPE = "Ya existe una receta con ese nombre para este producto.";
const INACTIVE_PRODUCT = "El producto seleccionado no existe o está inactivo.";
const PERMISSION_ERROR = "No tienes permisos para gestionar recetas técnicas.";

const duplicatedRecipe: RecipeProblem = {
  error: DUPLICATED_RECIPE,
  fieldErrors: { nombre_receta: [DUPLICATED_RECIPE] },
};
const inactiveProduct: RecipeProblem = { error: INACTIVE_PRODUCT, fieldErrors: { id_producto: [INACTIVE_PRODUCT] } };

function getRecipeFormValues(formData: FormData): TechnicalRecipeFormValues {
  const text = (name: keyof TechnicalRecipeFormValues) => formData.get(name)?.toString() ?? "";

  return {
    id_producto: text("id_producto"),
    nombre_receta: text("nombre_receta"),
    descripcion: text("descripcion"),
  };
}

function recipeError(
  values: TechnicalRecipeFormValues,
  error: string,
  fieldErrors?: FieldErrors,
): TechnicalRecipeFormState {
  return { status: "error", error, fieldErrors, values, operationId: newOperationId() };
}

// Una carrera por el nombre llega como violacion de uq_receta_producto_nombre: al
// crear no hay fila que bloquear.
function recipeSaveProblem(error: unknown): RecipeProblem {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return duplicatedRecipe;
  }

  return { error: "No se pudo guardar la receta. Intenta nuevamente." };
}

export async function createTechnicalRecipeAction(
  _prevState: TechnicalRecipeFormState,
  formData: FormData,
): Promise<TechnicalRecipeFormState> {
  const values = getRecipeFormValues(formData);
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return recipeError(values, PERMISSION_ERROR);
  }

  const parsed = technicalRecipeSchema.safeParse({
    id_producto: formData.get("id_producto"),
    nombre_receta: formData.get("nombre_receta"),
    descripcion: formData.get("descripcion") ?? "",
  });

  if (!parsed.success) {
    return recipeError(values, "Revisa los datos de la receta.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;

  let idReceta = "";
  let problem: RecipeProblem | null;

  try {
    // Un rechazo vuelve del callback sin escribir nada y la transaccion termina.
    problem = await prisma.$transaction(async (tx): Promise<RecipeProblem | null> => {
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
        return inactiveProduct;
      }

      const existingRecipe = await tx.receta_tecnica.findFirst({
        where: {
          id_producto: data.id_producto,
          nombre_receta: data.nombre_receta,
        },
      });

      if (existingRecipe) {
        return duplicatedRecipe;
      }

      idReceta = await getNextCorrelativeId(tx, {
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
    problem = recipeSaveProblem(error);
  }

  if (problem) {
    return recipeError(values, problem.error, problem.fieldErrors);
  }

  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/recipes");

  return { status: "success", data: { id_receta: idReceta }, values, operationId: newOperationId() };
}

// Activar e inactivar desde la fila (entrega 10.6b): devuelven el resultado para
// ConfirmActionButton en lugar de redirigir con ?toast=, y sin permiso responden
// con un error.
export async function toggleTechnicalRecipeStatusAction(
  _prevState: StatusToggleState,
  formData: FormData,
): Promise<StatusToggleState> {
  const idReceta = formData.get("id_receta")?.toString() ?? "";
  const session = await getAuthorizedSession(["ADMIN", "WORKSHOP_MASTER"]);

  if (!session) {
    return statusToggleError(idReceta, PERMISSION_ERROR);
  }

  const nextStatus = parseRequestedStatus(formData.get("estado"));

  if (!idReceta) {
    return statusToggleError(idReceta, "No se recibió la receta técnica.");
  }

  if (nextStatus === null) {
    return statusToggleError(idReceta, "Estado no válido.");
  }

  const estado = nextStatus ? "activa" : "inactiva";

  let problem: string | null;

  try {
    problem = await prisma.$transaction(async (tx) => {
      // Fija el estado pedido solo si la receta tiene el contrario: comparar y escribir
      // en una sola sentencia evita que una lista desactualizada o un doble clic hagan
      // lo contrario de lo que dice el boton. Este UPDATE choca con lockRecipeRow, asi
      // que tambien se ordena con quienes escriben las versiones y sus detalles.
      const [recipe] = await tx.receta_tecnica.updateManyAndReturn({
        where: {
          id_receta: idReceta,
          estado: nextStatus ? "inactiva" : "activa",
        },
        data: {
          estado,
        },
        select: {
          id_receta: true,
        },
      });

      // Nada cambio: no existe o ya tenia ese estado; no hay nada que registrar.
      if (!recipe) {
        const exists = await tx.receta_tecnica.findUnique({
          where: {
            id_receta: idReceta,
          },
          select: {
            id_receta: true,
          },
        });

        return exists ? `La receta ya estaba ${estado}.` : "La receta técnica seleccionada no existe.";
      }

      await registerAuditLog({
        userId: session.user.id,
        entidad_afectada: "receta_tecnica",
        id_registro_afectado: idReceta,
        accion: "ACTUALIZAR_RECETA",
        detalle: `Estado de receta técnica cambiado a ${estado}.`,
        tx,
      });

      return null;
    });
  } catch {
    problem = "No se pudo cambiar el estado de la receta. Intenta nuevamente.";
  }

  if (problem) {
    return statusToggleError(idReceta, problem);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/production");
  revalidatePath("/dashboard/production/recipes");

  return statusToggleDone(idReceta, nextStatus);
}
