import { z } from "zod";

import { MAX_COST_AMOUNT, MAX_COST_AMOUNT_TEXT, requiredAmount } from "@/schemas/costs/cost-amount";

export const laborCostSchema = z.object({
  id_costeo: z
    .string({ error: "El costeo es obligatorio." })
    .trim()
    .min(1, "El costeo es obligatorio.")
    .max(11, "El identificador del costeo no debe superar 11 caracteres."),

  costo_mano_obra: requiredAmount("El costo de mano de obra", {
    min: 0,
    minMessage: "El costo de mano de obra no puede ser negativo.",
    max: MAX_COST_AMOUNT,
    maxMessage: `El costo de mano de obra no debe superar ${MAX_COST_AMOUNT_TEXT}.`,
  }),
});

export type LaborCostInput = z.infer<typeof laborCostSchema>;
