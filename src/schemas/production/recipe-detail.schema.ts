import { z } from "zod";

// La columna tiene 2 decimales: por debajo de esto la base guardaria 0.00.
const MIN_CANTIDAD_REQUERIDA = 0.01;

/** Cantidad de una linea de receta: la misma regla en una linea suelta y en una version. */
export const cantidadRequeridaSchema = z.coerce
  .number({ error: "La cantidad requerida debe ser numérica." })
  .min(MIN_CANTIDAD_REQUERIDA, `La cantidad requerida debe ser de al menos ${MIN_CANTIDAD_REQUERIDA}.`)
  .max(999999.99, "La cantidad requerida es demasiado alta.");

export const recipeDetailSchema = z.object({
  id_version_receta: z
    .string({ error: "La versión de receta es obligatoria." })
    .trim()
    .min(1, "La versión de receta es obligatoria."),

  id_material: z
    .string({ error: "Seleccione un material o insumo." })
    .trim()
    .min(1, "Seleccione un material o insumo."),

  cantidad_requerida: cantidadRequeridaSchema,

  tipo_consumo: z.enum(["materia_prima", "consumible", "auxiliar"], {
    message: "Seleccione un tipo de consumo válido.",
  }),

  merma_estimada_porcentaje: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value || value.length === 0) {
        return null;
      }

      return Number(value);
    })
    .refine(
      (value) =>
        value === null ||
        (!Number.isNaN(value) && value >= 0 && value <= 100),
      "La merma estimada debe estar entre 0 y 100%."
    ),

  observaciones: z
    .string()
    .trim()
    .max(700, "Las observaciones no deben superar 700 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});