import { z } from "zod";

export const laborCostSchema = z.object({
  id_costeo: z
    .string()
    .trim()
    .min(1, "El costeo es obligatorio.")
    .max(11, "El identificador del costeo no debe superar 11 caracteres."),

  costo_mano_obra: z.coerce
    .number({
      message: "El costo de mano de obra debe ser numérico.",
    })
    .min(0, "El costo de mano de obra no puede ser negativo."),
});

export type LaborCostInput = z.infer<typeof laborCostSchema>;
