import { z } from "zod";

const moneySchema = z.preprocess((value) => {
  const text = value?.toString().trim();

  if (!text) {
    return undefined;
  }

  return text;
}, z.coerce.number().positive("El monto pagado debe ser mayor que cero."));

export const paymentSchema = z.object({
  id_proforma: z.string().min(1, "La proforma es obligatoria."),

  monto_pagado: moneySchema,

  metodo_pago: z.enum(["efectivo", "transferencia", "yape", "plin", "otro"], {
    error: "Selecciona un método de pago válido.",
  }),

  tipo_pago: z.enum(["adelanto", "amortizacion", "cancelacion"], {
    error: "Selecciona un tipo de pago válido.",
  }),

  observaciones: z
    .string()
    .max(500, "Las observaciones no deben superar 500 caracteres.")
    .optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;