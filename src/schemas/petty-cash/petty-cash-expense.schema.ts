import { z } from "zod";

export const pettyCashExpenseSchema = z.object({
  id_caja_chica: z
    .string()
    .trim()
    .min(1, "Debe seleccionar una caja chica."),

  id_categoria_gasto: z
    .string()
    .trim()
    .min(1, "Debe seleccionar una categoría de gasto."),

  concepto: z
    .string()
    .trim()
    .min(3, "El concepto debe tener al menos 3 caracteres.")
    .max(150, "El concepto no debe superar los 150 caracteres."),

  monto: z
    .string()
    .trim()
    .min(1, "El monto es obligatorio.")
    .transform((value, ctx) => {
      const amount = Number(value);

      if (Number.isNaN(amount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El monto debe ser un número válido.",
        });

        return z.NEVER;
      }

      if (amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El monto debe ser mayor a cero.",
        });

        return z.NEVER;
      }

      return amount;
    }),

  fecha_movimiento: z
    .string()
    .trim()
    .min(1, "La fecha del egreso es obligatoria.")
    .transform((value) => new Date(`${value}T00:00:00`)),

  comprobante: z
    .string()
    .trim()
    .max(50, "El comprobante no debe superar los 50 caracteres.")
    .optional()
    .or(z.literal("")),

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