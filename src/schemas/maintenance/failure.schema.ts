import { z } from "zod";

const failureStatuses = ["pendiente", "en_atencion", "reparada", "anulada"];

export const failureSchema = z.object({
  id_maquina: z
    .string()
    .trim()
    .length(11, "Seleccione una máquina válida."),

  fecha_falla: z
    .string()
    .trim()
    .min(1, "La fecha de la falla es obligatoria.")
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "La fecha de la falla no es válida.",
    )
    .transform((value) => new Date(value)),

  descripcion: z
    .string()
    .trim()
    .min(5, "La descripción de la falla debe tener al menos 5 caracteres.")
    .max(1000, "La descripción de la falla no debe superar los 1000 caracteres."),

  responsable_registro: z
    .string()
    .trim()
    .max(100, "El responsable no debe superar los 100 caracteres.")
    .optional()
    .or(z.literal("")),

  estado_atencion: z
    .string()
    .trim()
    .refine(
      (value) => failureStatuses.includes(value),
      "Seleccione un estado de atención válido.",
    ),

  tiempo_perdido_horas: z
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
          message: "El tiempo perdido debe ser un número válido.",
        });

        return z.NEVER;
      }

      if (hours < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El tiempo perdido no puede ser negativo.",
        });

        return z.NEVER;
      }

      return hours;
    }),

  impacto_produccion: z
    .string()
    .trim()
    .max(1000, "El impacto en producción no debe superar los 1000 caracteres.")
    .optional()
    .or(z.literal("")),
});

export const failureStatusSchema = z.object({
  id_falla: z
    .string()
    .trim()
    .length(11, "El identificador de la falla no es válido."),

  estado_atencion: z
    .string()
    .trim()
    .refine(
      (value) => failureStatuses.includes(value),
      "Seleccione un estado de atención válido.",
    ),
});