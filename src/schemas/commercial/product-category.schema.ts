import { z } from "zod";

export const productCategorySchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre de la categoría es obligatorio.")
    .max(80, "El nombre no debe superar 80 caracteres."),
  descripcion: z.string().trim().max(500).optional(),
});

export type ProductCategoryInput = z.infer<typeof productCategorySchema>;
