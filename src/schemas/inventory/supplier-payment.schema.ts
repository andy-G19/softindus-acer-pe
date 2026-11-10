import { z } from "zod";

import { toCents } from "@/lib/decimal-cents";
import { operationKeySchema } from "@/schemas/operation-key.schema";

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

const POSITIVE_AMOUNT = "El monto pagado debe ser mayor que cero.";

export const supplierPaymentSchema = z.object({
  id_compra: z.string().trim().min(1, "La compra es obligatoria."),

  // Clave de idempotencia del formulario (OperationKeyField, 11.2a).
  clave_operacion: operationKeySchema,

  fecha_pago: z
    .string()
    .trim()
    .min(1, "La fecha de pago es obligatoria."),

  // Hallazgo 6 de la 11.2a: la columna numeric(12, 2) guardaria 0.004 como 0.00.
  // El monto se mide en centesimos, con el redondeo de la columna: una sola regla
  // rechaza el cero, los negativos y lo que se guardaria como cero.
  monto_pagado: z.coerce
    .number()
    .refine((value) => (toCents(value) ?? 0n) > 0n, { message: POSITIVE_AMOUNT }),

  metodo_pago: z.enum(["efectivo", "transferencia", "yape", "plin", "otro"], {
    message: "Seleccione un método de pago válido.",
  }),

  observaciones: optionalText(500),
});