import { formatCents, toCents } from "@/lib/decimal-cents";
import type { AmountValue } from "@/lib/supplier-payment-amounts";

/**
 * Montos de caja chica (C2 de la 11.4a, D43).
 *
 * `movimiento_caja.monto` y `caja_chica.saldo_actual` son numeric(12, 2). La accion mandaba el
 * monto escrito: la columna del movimiento lo redondeaba y el saldo redondeaba la resta, que no es
 * lo mismo (un egreso de 40.005 sobre 100.00 guardaba un movimiento de 40.01 y dejaba el saldo en
 * 60.00). Ahora el monto se redondea a dos decimales, en centesimos enteros sobre el decimal
 * escrito (decimal-cents.ts), antes de compararlo con el saldo guardado y de escribirlo: lo que se
 * manda es lo que se guarda.
 *
 * Funciones puras, sin Prisma ni `server-only`.
 */

function cents(value: AmountValue) {
  // Un Decimal de Prisma se lee por su texto, el mismo que guarda la base; un valor que no es un
  // numero no llega aqui porque el esquema lo rechaza.
  return toCents(String(value)) ?? 0n;
}

/** El monto de un ingreso o de un ajuste positivo, como lo guarda la columna. */
export function roundCashAmount(amount: AmountValue) {
  return formatCents(cents(amount));
}

export type CashWithdrawalResult = { accepted: false; balance: string } | { accepted: true; amount: string };

/**
 * Un egreso o un ajuste negativo: se rechaza si, redondeado como la columna, supera el saldo
 * guardado (con el saldo, para el mensaje); si no, el monto que se guarda y se descuenta.
 */
export function checkCashWithdrawal({
  balance,
  amount,
}: {
  balance: AmountValue;
  amount: AmountValue;
}): CashWithdrawalResult {
  const balanceCents = cents(balance);
  const amountCents = cents(amount);

  if (amountCents > balanceCents) {
    return { accepted: false, balance: formatCents(balanceCents) };
  }

  return { accepted: true, amount: formatCents(amountCents) };
}
