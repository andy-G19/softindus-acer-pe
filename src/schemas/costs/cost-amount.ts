import { z } from "zod";

// Importes de Costos (hallazgos 66 y 72 de la 10.8). z.coerce.number convertia el campo
// vacio y el ausente en 0 y no tenia maximo: costeo.costo_mano_obra, costo_indirecto.monto
// y margen_ganancia.precio_final son numeric(12,2), y un valor mayor llegaba a la base y
// daba un error 500. Cada error lleva su mensaje en espanol.
export const MAX_COST_AMOUNT = 9_999_999_999.99;
export const MAX_COST_AMOUNT_TEXT = "S/ 9,999,999,999.99";

type AmountLimits = {
  min: number;
  minMessage: string;
  max: number;
  maxMessage: string;
};

/** Un importe obligatorio: `subject` es el sujeto del mensaje («El monto»). */
export function requiredAmount(subject: string, limits: AmountLimits) {
  const required = `${subject} es obligatorio.`;

  return z
    .string({ error: required })
    .trim()
    .min(1, required)
    .pipe(
      z.coerce
        .number<string>({ error: `${subject} debe ser numérico.` })
        .min(limits.min, limits.minMessage)
        .max(limits.max, limits.maxMessage),
    );
}

/** Un importe opcional: vacio, con solo espacios o ausente da null. */
export function optionalAmount(subject: string, limits: AmountLimits) {
  return z
    .preprocess(
      (value) => (value === null || value === undefined || String(value).trim() === "" ? undefined : value),
      z.coerce
        .number({ error: `${subject} debe ser numérico.` })
        .min(limits.min, limits.minMessage)
        .max(limits.max, limits.maxMessage)
        .optional(),
    )
    .transform((value) => value ?? null);
}
