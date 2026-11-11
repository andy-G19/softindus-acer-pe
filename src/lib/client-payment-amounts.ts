import { formatCents, toCents } from "@/lib/decimal-cents";
import type { AmountValue } from "@/lib/supplier-payment-amounts";

/**
 * Montos de una proforma y efecto de un pago de cliente (C2 de la 11.3a).
 *
 * La accion y los formularios sumaban y restaban con number: 100.10 + 200.20 daba
 * 300.29999999999995 y un adelanto de 300.30 se rechazaba por «mayor que el total»; con un
 * pago o un adelanto de 0.125 sobre 10.00 el saldo era 9.88 mientras la columna guardaba el
 * pago como 0.13, y pago y saldo sumaban 10.01. Ahora todo se cuenta en centesimos enteros
 * sobre el decimal escrito (decimal-cents.ts), con el redondeo de las columnas
 * numeric(12, 2): `proforma.monto_total`, `adelanto_inicial` y `saldo`, y
 * `pago_cliente.monto_pagado` y `saldo_actual`.
 *
 * El pago parte del saldo guardado en la proforma y no lo recalcula desde los pagos (D25): no
 * se sabe si las proformas antiguas registraron su adelanto como pago.
 *
 * Funciones puras, sin Prisma ni `server-only`: las usan las acciones, la pagina y los
 * formularios.
 */

export type QuoteStatus = "vigente" | "aceptada" | "pagada";

function cents(value: AmountValue) {
  // Un Decimal de Prisma se lee por su texto, el mismo que guarda la base; un valor que no
  // es un numero no llega aqui porque el esquema lo rechaza.
  return toCents(String(value)) ?? 0n;
}

/** El monto tiene al menos un centimo tal como lo guardaria la columna. */
export function hasCents(value: AmountValue | null | undefined) {
  return value !== null && value !== undefined && cents(value) > 0n;
}

/** Total de la proforma: la suma de los subtotales guardados del pedido. */
export function calculateQuoteTotal(subtotals: AmountValue[]) {
  return formatCents(subtotals.reduce<bigint>((sum, subtotal) => sum + cents(subtotal), 0n));
}

export type QuoteAmounts =
  | { accepted: false; reason: "sin_total" | "adelanto_mayor" }
  | { accepted: true; total: string; advance: string | null; balance: string; status: QuoteStatus };

/**
 * Lo que guarda una proforma nueva: el total, el adelanto (null si no hay), el saldo y el
 * estado. Sin adelanto nace vigente; con adelanto, aceptada, o pagada si cubre el total.
 */
export function calculateQuoteAmounts({
  subtotals,
  advance,
}: {
  subtotals: AmountValue[];
  advance?: AmountValue | null;
}): QuoteAmounts {
  const total = subtotals.reduce<bigint>((sum, subtotal) => sum + cents(subtotal), 0n);

  if (total <= 0n) {
    return { accepted: false, reason: "sin_total" };
  }

  const advanceCents = advance === null || advance === undefined ? 0n : cents(advance);

  if (advanceCents > total) {
    return { accepted: false, reason: "adelanto_mayor" };
  }

  const balance = total - advanceCents;
  let status: QuoteStatus = "aceptada";

  if (advanceCents === 0n) {
    status = "vigente";
  } else if (balance <= 0n) {
    status = "pagada";
  }

  return {
    accepted: true,
    total: formatCents(total),
    advance: advanceCents > 0n ? formatCents(advanceCents) : null,
    balance: formatCents(balance),
    status,
  };
}

export type ClientPaymentResult =
  | { accepted: false; balance: string }
  | { accepted: true; amount: string; newBalance: string; status: Exclude<QuoteStatus, "vigente"> };

/**
 * Lo que deja un pago de cliente sobre el saldo guardado: se rechaza si supera el saldo; si
 * no, el monto y el saldo que se guardan y el estado de la proforma. El monto se redondea a
 * dos decimales antes de compararlo y restarlo, como la columna.
 */
export function calculateClientPayment({
  balance,
  amount,
}: {
  balance: AmountValue;
  amount: AmountValue;
}): ClientPaymentResult {
  const balanceCents = cents(balance);
  const payment = cents(amount);

  if (payment > balanceCents) {
    return { accepted: false, balance: formatCents(balanceCents) };
  }

  const newBalance = balanceCents - payment;

  return {
    accepted: true,
    amount: formatCents(payment),
    newBalance: formatCents(newBalance),
    status: newBalance <= 0n ? "pagada" : "aceptada",
  };
}
