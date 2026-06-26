import { z } from "zod";

const paymentMethods = ["efectivo", "transferencia", "yape", "plin", "otro"];

export const operatorPaymentSchema = z.object({
  id_planilla: z
    .string()
    .trim()
    .min(1, "Debe seleccionar una planilla pendiente."),

  fecha_pago: z
    .string()
    .trim()
    .min(1, "La fecha de pago es obligatoria.")
    .transform((value) => new Date(`${value}T00:00:00`)),

  monto_pagado: z
    .string()
    .trim()
    .min(1, "El monto pagado es obligatorio.")
    .transform((value, ctx) => {
      const amount = Number(value);

      if (Number.isNaN(amount)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El monto pagado debe ser un número válido.",
        });

        return z.NEVER;
      }

      if (amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El monto pagado debe ser mayor a cero.",
        });

        return z.NEVER;
      }

      return amount;
    }),

  metodo_pago: z
    .string()
    .trim()
    .refine(
      (value) => paymentMethods.includes(value),
      "Seleccione un método de pago válido.",
    ),

  observaciones: z
    .string()
    .trim()
    .max(500, "Las observaciones no deben superar los 500 caracteres.")
    .optional()
    .or(z.literal("")),
});