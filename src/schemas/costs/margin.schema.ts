import { z } from "zod";

import {
  MAX_COST_AMOUNT,
  MAX_COST_AMOUNT_TEXT,
  optionalAmount,
  requiredAmount,
} from "@/schemas/costs/cost-amount";

export const marginSchema = z.object({
  id_costeo: z
    .string({ error: "El costeo es obligatorio." })
    .trim()
    .min(1, "El costeo es obligatorio.")
    .max(11, "El identificador del costeo no debe superar 11 caracteres."),

  porcentaje_margen: requiredAmount("El porcentaje de margen", {
    min: 15,
    minMessage: "El margen mínimo permitido es 15%.",
    max: 20,
    maxMessage: "El margen máximo permitido es 20%.",
  }),

  // Sin precio final (vacio o sin el campo) la accion usa el precio sugerido.
  precio_final: optionalAmount("El precio final", {
    min: 0,
    minMessage: "El precio final no puede ser negativo.",
    max: MAX_COST_AMOUNT,
    maxMessage: `El precio final no debe superar ${MAX_COST_AMOUNT_TEXT}.`,
  }),

  motivo_ajuste: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type MarginInput = z.infer<typeof marginSchema>;
