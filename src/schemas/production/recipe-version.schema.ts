import { z } from "zod";

export const recipeVersionSchema = z.object({
  id_receta: z
    .string()
    .trim()
    .min(1, "La receta técnica es obligatoria."),

  numero_version: z
    .string()
    .trim()
    .min(1, "El número de versión es obligatorio.")
    .max(20, "El número de versión no debe superar 20 caracteres."),

  motivo_cambio: z
    .string()
    .trim()
    .max(700, "El motivo no debe superar 700 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});