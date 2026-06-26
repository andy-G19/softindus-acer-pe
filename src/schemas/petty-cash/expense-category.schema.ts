import { z } from "zod";

export const expenseCategorySchema = z.object({
  nombre_categoria: z
    .string()
    .trim()
    .min(3, "El nombre de la categoría debe tener al menos 3 caracteres.")
    .max(80, "El nombre de la categoría no debe superar los 80 caracteres."),

  descripcion: z
    .string()
    .trim()
    .max(500, "La descripción no debe superar los 500 caracteres.")
    .optional()
    .or(z.literal("")),

  estado: z.enum(["true", "false"]).default("true"),
});