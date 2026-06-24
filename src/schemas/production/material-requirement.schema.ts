import { z } from "zod";

export const materialRequirementCalculationSchema = z.object({
  quantity: z.coerce
    .number()
    .positive("La cantidad a fabricar debe ser mayor a 0.")
    .max(999999.99, "La cantidad a fabricar es demasiado alta."),
});