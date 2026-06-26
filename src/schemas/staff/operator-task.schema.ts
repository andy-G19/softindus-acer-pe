import { z } from "zod";

const taskStatuses = ["registrada", "en_proceso", "terminada", "anulada"];

export const operatorTaskSchema = z.object({
  id_operario: z
    .string()
    .trim()
    .min(1, "Debe seleccionar un operario."),

  id_orden_trabajo: z
    .string()
    .trim()
    .min(1, "Debe seleccionar una orden de trabajo."),

  id_etapa_ruta: z
    .string()
    .trim()
    .optional()
    .or(z.literal("")),

  fecha_tarea: z
    .string()
    .trim()
    .min(1, "La fecha de la tarea es obligatoria.")
    .transform((value) => new Date(`${value}T00:00:00`)),

  descripcion: z
    .string()
    .trim()
    .min(5, "La descripción debe tener al menos 5 caracteres.")
    .max(255, "La descripción no debe superar los 255 caracteres."),

  horas_dedicadas: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((value, ctx) => {
      if (!value) {
        return null;
      }

      const hours = Number(value);

      if (Number.isNaN(hours)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Las horas dedicadas deben ser un número válido.",
        });

        return z.NEVER;
      }

      if (hours < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Las horas dedicadas no pueden ser negativas.",
        });

        return z.NEVER;
      }

      if (hours > 24) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Las horas dedicadas no pueden superar 24 horas.",
        });

        return z.NEVER;
      }

      return hours;
    }),

  estado: z
    .string()
    .trim()
    .refine(
      (value) => taskStatuses.includes(value),
      "Seleccione un estado válido para la tarea.",
    ),

  observaciones: z
    .string()
    .trim()
    .max(500, "Las observaciones no deben superar los 500 caracteres.")
    .optional()
    .or(z.literal("")),
});