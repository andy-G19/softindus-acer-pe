import { z } from "zod";

export const inventoryCatalogSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre es obligatorio.")
    .max(80, "El nombre no debe superar 80 caracteres."),
  slug: z
    .string()
    .trim()
    .min(1, "El slug es obligatorio.")
    .max(80, "El slug no debe superar 80 caracteres.")
    .regex(
      /^[a-z0-9_]+$/,
      "El slug solo puede usar minúsculas, números y guiones bajos.",
    ),
  descripcion: z.string().trim().max(500).optional(),
});

export type InventoryCatalogInput = z.infer<typeof inventoryCatalogSchema>;
