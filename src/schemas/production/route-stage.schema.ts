import { z } from "zod";

export const routeStageSchema = z.object({
  id_ruta: z.string().trim().min(1, "La ruta de fabricación es obligatoria."),

  nombre_etapa: z
    .string()
    .trim()
    .min(3, "El nombre de la etapa debe tener al menos 3 caracteres.")
    .max(100, "El nombre de la etapa no debe superar 100 caracteres."),

  orden_secuencia: z.coerce
    .number()
    .int("El orden debe ser un número entero.")
    .min(1, "El orden debe ser mayor o igual a 1.")
    .max(999, "El orden no debe superar 999."),

  descripcion: z
    .string()
    .trim()
    .max(500, "La descripción no debe superar 500 caracteres.")
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),

  tiempo_estimado_horas: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value || value.length === 0) {
        return null;
      }

      return Number(value);
    })
    .refine(
      (value) =>
        value === null ||
        (!Number.isNaN(value) && value > 0 && value <= 9999.99),
      "El tiempo estimado debe ser mayor a 0."
    ),

  requiere_maquina: z.boolean(),
});