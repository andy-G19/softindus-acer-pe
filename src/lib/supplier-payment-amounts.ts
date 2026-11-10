import { formatCents, toCents } from "@/lib/decimal-cents";

/**
 * Saldo de una compra y efecto de un pago a proveedor (11.2a, hallazgos 1 y 2).
 *
 * La accion y el detalle restaban los pagos con number: tras pagar 50.10 de una
 * compra de 100.30 el saldo era 50.199999999999996 y pagar 50.20 se rechazaba;
 * un ultimo pago podia dejar un residuo de 1e-14 que mantenia la compra
 * «parcial» con un saldo guardado de 0.00, y el detalle seguia ofreciendo el
 * formulario. Ahora todo se cuenta en centesimos enteros sobre el decimal
 * escrito (decimal-cents.ts), con el redondeo de las columnas numeric(12, 2):
 * `compra.monto_total`, `pago_proveedor.monto_pagado` y `saldo_pendiente`.
 *
 * Funciones puras, sin Prisma ni `server-only`: las usan la accion y la pagina.
 */

/** Un importe tal como llega: number del esquema, texto o un Decimal de Prisma. */
export type AmountValue = number | string | { toString(): string };

export type SupplierPaymentStatus = "pendiente" | "parcial" | "pagado";

function cents(value: AmountValue) {
  // Un Decimal de Prisma se lee por su texto, el mismo que guarda la base; un
  // valor que no es un numero no llega aqui porque el esquema lo rechaza.
  return toCents(String(value)) ?? 0n;
}

function balanceCents(total: AmountValue, payments: AmountValue[]) {
  const paid = payments.reduce<bigint>((sum, payment) => sum + cents(payment), 0n);

  return { paid, balance: cents(total) - paid };
}

/** Total pagado y saldo pendiente de una compra, como texto con dos decimales. */
export function calculatePurchaseBalance(total: AmountValue, payments: AmountValue[]) {
  const { paid, balance } = balanceCents(total, payments);

  return { totalPaid: formatCents(paid), balance: formatCents(balance) };
}

export type SupplierPaymentResult =
  | { accepted: false; balance: string }
  | {
      accepted: true;
      amount: string;
      newBalance: string;
      status: SupplierPaymentStatus;
    };

/**
 * Lo que deja un pago nuevo: se rechaza si supera el saldo; si no, el monto y el
 * saldo que se guardan y el estado de pago de la compra. El orden es el de las
 * columnas: el monto se redondea a dos decimales antes de compararlo y restarlo.
 */
export function calculateSupplierPayment({
  total,
  previousPayments,
  amount,
}: {
  total: AmountValue;
  previousPayments: AmountValue[];
  amount: AmountValue;
}): SupplierPaymentResult {
  const { balance } = balanceCents(total, previousPayments);
  const payment = cents(amount);

  if (payment > balance) {
    return { accepted: false, balance: formatCents(balance) };
  }

  const newBalance = balance - payment;
  let status: SupplierPaymentStatus = "pendiente";

  if (newBalance <= 0n) {
    status = "pagado";
  } else if (newBalance < cents(total)) {
    status = "parcial";
  }

  return {
    accepted: true,
    amount: formatCents(payment),
    newBalance: formatCents(newBalance),
    status,
  };
}
