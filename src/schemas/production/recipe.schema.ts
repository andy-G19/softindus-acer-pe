import { z } from "zod";

export const technicalRecipeSchema = z.object({
  id_producto: z
    .string()
    .trim()
    .min(1, "Seleccione un producto."),

  nombre_receta: z
    .string()
    .trim()
    .min(3, "El nombre de la receta debe tener al menos 3 caracteres.")
    .max(100, "El nombre de la receta no debe superar 100 caracteres."),

  descripcion: z
    .string()
    .trim()
    .max(700, "La descripción no debe superar 700 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});