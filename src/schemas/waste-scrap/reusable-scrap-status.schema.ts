import { z } from "zod";

const validReusableScrapStatuses = ["reutilizado", "descartado"] as const;

export const reusableScrapStatusSchema = z.object({
  id_retazo: z
    .string()
    .trim()
    .min(1, "Debe seleccionar un retazo.")
    .max(11, "El identificador del retazo no debe superar 11 caracteres."),

  estado: z.enum(validReusableScrapStatuses, {
    message: "Debe seleccionar un estado válido para el retazo.",
  }),
});

export type ReusableScrapStatusInput = z.infer<
  typeof reusableScrapStatusSchema
>;
