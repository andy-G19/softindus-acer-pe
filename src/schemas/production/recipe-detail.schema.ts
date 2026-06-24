import { z } from "zod";

export const recipeDetailSchema = z.object({
  id_version_receta: z
    .string()
    .trim()
    .min(1, "La versión de receta es obligatoria."),

  id_material: z
    .string()
    .trim()
    .min(1, "Seleccione un material o insumo."),

  cantidad_requerida: z.coerce
    .number()
    .positive("La cantidad requerida debe ser mayor a 0.")
    .max(999999.99, "La cantidad requerida es demasiado alta."),

  tipo_consumo: z
    .string()
    .trim()
    .min(1, "Seleccione el tipo de consumo.")
    .max(30, "El tipo de consumo no debe superar 30 caracteres."),

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