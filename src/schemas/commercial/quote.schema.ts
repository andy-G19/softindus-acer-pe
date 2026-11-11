import { z } from "zod";

import { hasCents } from "@/lib/client-payment-amounts";

const optionalMoneySchema = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const text = value.toString().trim();

  if (!text) {
    return undefined;
  }

  return text;
}, z.coerce
  .number()
  .min(0, "El monto no puede ser negativo.")
  // C2 de la 11.3a: un adelanto que la columna guardaria como 0.00 se registraria como un
  // pago de 0.00. Cero (o vacio) sigue siendo «sin adelanto».
  .refine((value) => value === 0 || hasCents(value), "El adelanto debe ser cero o de al menos S/ 0.01.")
  .optional());

const optionalPositiveIntegerSchema = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const text = value.toString().trim();

  if (!text) {
    return undefined;
  }

  return text;
}, z.coerce.number().int("La validez debe ser un número entero.").positive("La validez debe ser mayor que cero.").optional());

const optionalPaymentMethodSchema = z.preprocess(
  (value) => {
    const text = value?.toString().trim();

    return text ? text : undefined;
  },
  z
    .enum(["efectivo", "transferencia", "yape", "plin", "otro"], {
      error: "Selecciona un método de pago válido.",
    })
    .optional(),
);

export const quoteSchema = z
  .object({
    id_pedido: z.string().min(1, "Debes seleccionar un pedido."),

    adelanto_inicial: optionalMoneySchema,

    // Solo se exige cuando hay adelanto: el adelanto se registra como un pago
    // real del cliente y necesita método de pago, igual que cualquier otro.
    metodo_pago_adelanto: optionalPaymentMethodSchema,

    validez_dias: optionalPositiveIntegerSchema,

    observaciones: z
      .string()
      .max(500, "Las observaciones no deben superar 500 caracteres.")
      .optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.adelanto_inicial ?? 0) > 0 && !data.metodo_pago_adelanto) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecciona el método de pago del adelanto.",
        path: ["metodo_pago_adelanto"],
      });
    }
  });

export type QuoteInput = z.infer<typeof quoteSchema>;