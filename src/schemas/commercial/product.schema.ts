import { z } from "zod";

export const productSchema = z.object({
  nombre_producto: z
    .string()
    .trim()
    .min(2, "El nombre del producto es obligatorio.")
    .max(100, "El nombre no debe superar 100 caracteres."),

  categoria: z
    .string()
    .trim()
    .min(1, "La categoría es obligatoria.")
    .max(80, "La categoría no debe superar 80 caracteres."),

  descripcion: z.string().trim().max(500).optional(),

  unidad_medida: z
    .string()
    .trim()
    .min(1, "La unidad de medida es obligatoria.")
    .max(20, "La unidad no debe superar 20 caracteres."),

  precio_referencial: z.coerce
    .number()
    .min(0, "El precio referencial no puede ser negativo.")
    .optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
