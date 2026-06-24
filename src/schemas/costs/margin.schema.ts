import { z } from "zod";

export const marginSchema = z.object({
  id_costeo: z
    .string()
    .trim()
    .min(1, "El costeo es obligatorio.")
    .max(11, "El identificador del costeo no debe superar 11 caracteres."),

  porcentaje_margen: z.coerce
    .number({
      message: "El porcentaje de margen debe ser numérico.",
    })
    .min(15, "El margen mínimo permitido es 15%.")
    .max(20, "El margen máximo permitido es 20%."),

  precio_final: z
    .union([
      z.literal(""),
      z.coerce.number({
        message: "El precio final debe ser numérico.",
      }),
    ])
    .optional()
    .transform((value) => {
      if (value === "" || value === undefined) {
        return null;
      }

      return value;
    }),

  motivo_ajuste: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type MarginInput = z.infer<typeof marginSchema>;