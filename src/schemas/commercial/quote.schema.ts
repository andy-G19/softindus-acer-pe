import { z } from "zod";

const optionalMoneySchema = z.preprocess((value) => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const text = value.toString().trim();

  if (!text) {
    return undefined;
  }

  return text;
}, z.coerce.number().min(0, "El monto no puede ser negativo.").optional());

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

export const quoteSchema = z.object({
  id_pedido: z.string().min(1, "Debes seleccionar un pedido."),

  adelanto_inicial: optionalMoneySchema,

  validez_dias: optionalPositiveIntegerSchema,

  observaciones: z
    .string()
    .max(500, "Las observaciones no deben superar 500 caracteres.")
    .optional(),
});

export type QuoteInput = z.infer<typeof quoteSchema>;