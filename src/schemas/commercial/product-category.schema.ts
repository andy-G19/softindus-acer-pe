import { z } from "zod";

// Cada error tiene su mensaje en espanol: sin el, Zod devuelve el suyo en
// ingles (entrega 10.4a).
export const productCategorySchema = z.object({
  nombre: z
    .string({ error: "El nombre de la categoría es obligatorio." })
    .trim()
    .min(2, "El nombre de la categoría es obligatorio.")
    .max(80, "El nombre no debe superar 80 caracteres."),
  descripcion: z.string().trim().max(500, "La descripción no debe superar 500 caracteres.").optional(),
});

export type ProductCategoryInput = z.infer<typeof productCategorySchema>;
