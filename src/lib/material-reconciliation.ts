/**
 * Conciliación de materiales de una orden de trabajo.
 *
 * La identidad que sostiene todo el flujo:
 *
 *     entregado = consumido + devuelto + merma
 *
 * La merma NO se almacena: se deriva. Persistirla crearía un valor capaz de desviarse de
 * sus propios sumandos, y la única forma de detectarlo sería recalcularla, con lo cual
 * guardarla no aporta nada.
 *
 * Función pura: sin Prisma y sin `server-only`, para poder probarla sin base de datos.
 */

import { roundQuantity } from "@/lib/recipe-quantities";

/** Los Decimal de Prisma llegan como objeto con `toString()`, no como número nativo. */
type NumericInput = number | string | { toString(): string } | null | undefined;

function toNonNegativeNumber(value: NumericInput) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value.toString());

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

export type MaterialMovementTotals = {
  /** Total salido del almacén hacia producción. */
  delivered: NumericInput;
  /** Lo que producción declara haber usado realmente. */
  consumed: NumericInput;
  /** Lo que volvió al almacén intacto. */
  returned: NumericInput;
};

/**
 * Merma derivada: lo entregado que no se consumió ni regresó al almacén.
 *
 * Puede dar negativo si alguien declara consumo y devolución por encima de lo entregado.
 * No se recorta a cero a propósito: un negativo es un dato incoherente y conviene que se
 * vea, no que se disimule. `validateClosure` es quien lo impide antes de persistir.
 */
export function calculateWaste(totals: MaterialMovementTotals) {
  return roundQuantity(
    toNonNegativeNumber(totals.delivered) -
      toNonNegativeNumber(totals.consumed) -
      toNonNegativeNumber(totals.returned),
  );
}

/**
 * Lo que todavía falta entregar contra el plan congelado.
 *
 * Se recorta en cero: si se entregó de más (permitido mediante entregas adicionales), lo
 * pendiente es cero, no un número negativo.
 */
export function calculatePendingDelivery(params: {
  required: NumericInput;
  delivered: NumericInput;
}) {
  const pending =
    toNonNegativeNumber(params.required) - toNonNegativeNumber(params.delivered);

  return pending > 0 ? roundQuantity(pending) : 0;
}

/** Se entregó más de lo que el requerimiento congelado pedía. */
export function isOverDelivered(params: {
  required: NumericInput;
  delivered: NumericInput;
}) {
  return (
    roundQuantity(toNonNegativeNumber(params.delivered)) >
    roundQuantity(toNonNegativeNumber(params.required))
  );
}

export type ClosureValidation =
  | { ok: true; waste: number }
  | { ok: false; error: string };

/**
 * Valida el cierre de materiales de una línea antes de persistirlo.
 *
 * La regla es una sola: no se puede consumir y devolver, entre ambos, más de lo que salió
 * del almacén. Todo lo demás (merma no negativa) se sigue de ahí.
 */
export function validateClosure(
  totals: MaterialMovementTotals,
  materialName?: string,
): ClosureValidation {
  const delivered = roundQuantity(toNonNegativeNumber(totals.delivered));
  const consumed = roundQuantity(toNonNegativeNumber(totals.consumed));
  const returned = roundQuantity(toNonNegativeNumber(totals.returned));

  const declared = roundQuantity(consumed + returned);
  const prefix = materialName ? `${materialName}: ` : "";

  if (declared > delivered) {
    return {
      ok: false,
      error: `${prefix}lo consumido (${consumed.toFixed(2)}) más lo devuelto (${returned.toFixed(2)}) suma ${declared.toFixed(2)}, que supera lo entregado (${delivered.toFixed(2)}).`,
    };
  }

  return { ok: true, waste: calculateWaste({ delivered, consumed, returned }) };
}

export type MaterialLineSummary = {
  required: number;
  delivered: number;
  returned: number;
  consumed: number;
  waste: number;
  pendingDelivery: number;
  overDelivered: boolean;
};

/** Todo lo que una pantalla necesita mostrar de una línea de requerimiento. */
export function summarizeMaterialLine(params: {
  required: NumericInput;
  delivered: NumericInput;
  returned: NumericInput;
  consumed: NumericInput;
}): MaterialLineSummary {
  const required = roundQuantity(toNonNegativeNumber(params.required));
  const delivered = roundQuantity(toNonNegativeNumber(params.delivered));
  const returned = roundQuantity(toNonNegativeNumber(params.returned));
  const consumed = roundQuantity(toNonNegativeNumber(params.consumed));

  return {
    required,
    delivered,
    returned,
    consumed,
    waste: calculateWaste({ delivered, consumed, returned }),
    pendingDelivery: calculatePendingDelivery({ required, delivered }),
    overDelivered: isOverDelivered({ required, delivered }),
  };
}
