import { z } from "zod";

export const pettyCashBoxSchema = z.object({
  nombre_caja: z
    .string()
    .trim()
    .min(3, "El nombre de la caja debe tener al menos 3 caracteres.")
    .max(100, "El nombre de la caja no debe superar los 100 caracteres."),

  saldo_inicial: z
    .string()
    .trim()
    .min(1, "El saldo inicial es obligatorio.")
    .transform((value, ctx) => {
      const amount = Number(value);

      if (Number.isNaN(amount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El saldo inicial debe ser un número válido.",
        });

        return z.NEVER;
      }

      if (amount < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El saldo inicial no puede ser negativo.",
        });

        return z.NEVER;
      }

      return amount;
    }),

  fecha_apertura: z
    .string()
    .trim()
    .min(1, "La fecha de apertura es obligatoria.")
    .transform((value) => new Date(`${value}T00:00:00`)),

  responsable: z
    .string()
    .trim()
    .max(100, "El responsable no debe superar los 100 caracteres.")
    .optional()
    .or(z.literal("")),

  observaciones: z
    .string()
    .trim()
    .max(500, "Las observaciones no deben superar los 500 caracteres.")
    .optional()
    .or(z.literal("")),
});