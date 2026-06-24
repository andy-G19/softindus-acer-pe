import { z } from "zod";

export const profitabilitySchema = z.object({
  id_costeo: z
    .string()
    .trim()
    .min(1, "El costeo es obligatorio.")
    .max(11, "El identificador del costeo no debe superar 11 caracteres."),

  observaciones: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type ProfitabilityInput = z.infer<typeof profitabilitySchema>;