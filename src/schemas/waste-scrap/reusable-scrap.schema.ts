import { z } from "zod";

export const reusableScrapSchema = z.object({
  id_material: z
    .string()
    .trim()
    .min(1, "Debe seleccionar un material de origen.")
    .max(11, "El identificador del material no debe superar 11 caracteres."),

  id_orden_trabajo: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  medida_aproximada: z
    .string()
    .trim()
    .max(80, "La medida aproximada no debe superar 80 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  cantidad: z.coerce
    .number({
      message: "La cantidad debe ser numérica.",
    })
    .positive("La cantidad debe ser mayor que cero."),

  unidad_medida: z
    .string()
    .trim()
    .min(1, "La unidad de medida es obligatoria.")
    .max(20, "La unidad de medida no debe superar 20 caracteres."),

  ubicacion: z
    .string()
    .trim()
    .max(100, "La ubicación no debe superar 100 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type ReusableScrapInput = z.infer<typeof reusableScrapSchema>;