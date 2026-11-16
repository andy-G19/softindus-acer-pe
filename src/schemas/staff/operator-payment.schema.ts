import { z } from "zod";

import { toDateInputValue } from "@/lib/date-range";

// C3 de la 11.5 (D58): una fecha debe existir, con la regla de la asistencia (hallazgo 68 de la
// 10.8a): new Date convierte el 30 de febrero en el 2 de marzo sin avisar y un texto que no es
// fecha llegaba a Prisma como fecha invalida. Un POST hecho a mano puede omitir el campo
// (formData.get devuelve null): el mensaje sigue en espanol.
const isRealDate = (value: string) => toDateInputValue(value) === value;

const paymentMethods = ["efectivo", "transferencia", "yape", "plin", "otro"];

export const operatorPaymentSchema = z.object({
  id_planilla: z
    .string()
    .trim()
    .min(1, "Debe seleccionar una planilla pendiente."),

  fecha_pago: z
    .string({ error: "La fecha de pago es obligatoria." })
    .trim()
    .min(1, "La fecha de pago es obligatoria.")
    .refine((value) => !value || isRealDate(value), "La fecha de pago no es válida.")
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