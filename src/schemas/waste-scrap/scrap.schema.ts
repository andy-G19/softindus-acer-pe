import { z } from "zod";

const optionalPositiveNumber = z.preprocess(
  (value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    return value;
  },
  z.coerce
    .number({
      message: "El valor debe ser numérico.",
    })
    .positive("El valor debe ser mayor que cero.")
    .optional(),
);

export const scrapSchema = z
  .object({
    id_material: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),

    tipo_material: z
      .string()
      .trim()
      .min(2, "El tipo de material es obligatorio.")
      .max(50, "El tipo de material no debe superar 50 caracteres."),

    peso_kg: optionalPositiveNumber,

    cantidad: optionalPositiveNumber,

    observaciones: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value && value.length > 0 ? value : null)),
  })
  .refine((data) => data.peso_kg || data.cantidad, {
    message: "Debe registrar al menos peso en kg o cantidad aproximada.",
    path: ["peso_kg"],
  });

export type ScrapInput = z.infer<typeof scrapSchema>;