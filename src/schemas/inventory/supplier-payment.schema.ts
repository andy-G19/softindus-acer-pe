import { z } from "zod";

function optionalText(max: number) {
  return z.preprocess(
    (value) => {
      if (typeof value === "string" && value.trim() === "") {
        return undefined;
      }

      return value;
    },
    z.string().trim().max(max).optional(),
  );
}

export const supplierPaymentSchema = z.object({
  id_compra: z.string().trim().min(1, "La compra es obligatoria."),

  fecha_pago: z
    .string()
    .trim()
    .min(1, "La fecha de pago es obligatoria."),

  monto_pagado: z.coerce
    .number()
    .positive("El monto pagado debe ser mayor que cero."),

  metodo_pago: z.enum(["efectivo", "transferencia", "yape", "plin", "otro"], {
    message: "Seleccione un método de pago válido.",
  }),

  observaciones: optionalText(500),
});