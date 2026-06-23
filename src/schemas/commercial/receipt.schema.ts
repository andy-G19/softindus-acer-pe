import { z } from "zod";

const moneySchema = z.preprocess((value) => {
  const text = value?.toString().trim();

  if (!text) {
    return undefined;
  }

  return text;
}, z.coerce.number().positive("El monto total debe ser mayor que cero."));

export const receiptSchema = z.object({
  id_proforma: z.string().min(1, "La proforma es obligatoria."),

  tipo_comprobante: z.enum(["boleta", "factura", "recibo", "otro"], {
    error: "Selecciona un tipo de comprobante válido.",
  }),

  numero_comprobante: z
    .string()
    .trim()
    .min(1, "El número de comprobante es obligatorio.")
    .max(30, "El número de comprobante no debe superar 30 caracteres."),

  monto_total: moneySchema,

  observaciones: z
    .string()
    .max(500, "Las observaciones no deben superar 500 caracteres.")
    .optional(),
});

export type ReceiptInput = z.infer<typeof receiptSchema>;