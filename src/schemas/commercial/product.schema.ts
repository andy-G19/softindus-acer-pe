import { z } from "zod";

// Cada error tiene su mensaje en espanol: sin el, Zod devuelve el suyo en
// ingles (entrega 10.4a).
export const productSchema = z.object({
  nombre_producto: z
    .string({ error: "El nombre del producto es obligatorio." })
    .trim()
    .min(2, "El nombre del producto es obligatorio.")
    .max(100, "El nombre no debe superar 100 caracteres."),

  categoria: z
    .string({ error: "La categoría es obligatoria." })
    .trim()
    .min(1, "La categoría es obligatoria.")
    .max(80, "La categoría no debe superar 80 caracteres."),

  descripcion: z.string().trim().max(500, "La descripción no debe superar 500 caracteres.").optional(),

  unidad_medida: z
    .string({ error: "La unidad de medida es obligatoria." })
    .trim()
    .min(1, "La unidad de medida es obligatoria.")
    .max(20, "La unidad no debe superar 20 caracteres."),

  precio_referencial: z.coerce
    .number({ error: "El precio referencial debe ser numérico." })
    .min(0, "El precio referencial no puede ser negativo.")
    .optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
