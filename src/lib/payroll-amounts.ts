import { formatCents, toCents } from "@/lib/decimal-cents";
import type { AmountValue } from "@/lib/supplier-payment-amounts";

/**
 * Montos de una planilla y de su pago (C2 de la 11.5, D53).
 *
 * `planilla_pago.monto_bruto`, `descuentos` y `monto_neto`, y `historial_pago_operario.monto_pagado`
 * son numeric(12, 2). La accion calculaba con number y redondeaba cada monto por separado con
 * toFixed: con un descuento de 10.005 sobre 100.00 guardaba 10.01 de descuento y 90.00 de neto, y
 * la planilla no cuadraba. El pago se comparaba con el neto con una tolerancia de 0.01 que
 * dependia del error de coma flotante. Ahora todo se cuenta en centesimos enteros sobre el decimal
 * escrito (decimal-cents.ts), con el redondeo de las columnas, y se manda el texto que se guarda.
 *
 * La tarifa y su unidad no cambian: el bruto sigue siendo asistencias validas por tarifa (hallazgo
 * 57 de la 10.8a, decision de negocio pendiente).
 *
 * Funciones puras, sin Prisma ni `server-only`.
 */

function cents(value: AmountValue) {
  // Un Decimal de Prisma se lee por su texto, el mismo que guarda la base; un valor que no es un
  // numero no llega aqui porque el esquema lo rechaza.
  return toCents(String(value)) ?? 0n;
}

export type PayrollAmountsResult =
  | { accepted: false }
  | { accepted: true; gross: string; discount: string; net: string };

/**
 * Bruto, descuento y neto de una planilla: el bruto son las asistencias validas por la tarifa, el
 * descuento se redondea como su columna y el neto es el bruto menos ese descuento redondeado. Se
 * rechaza un descuento que, redondeado, iguala o supera el bruto: un neto de 0.00 no se podria
 * pagar, porque el pago exige un monto mayor que cero (C5 de la 11.5, D56).
 */
export function calculatePayrollAmounts({
  validAttendances,
  rate,
  discount,
}: {
  validAttendances: number;
  rate: AmountValue;
  discount: AmountValue;
}): PayrollAmountsResult {
  const grossCents = BigInt(validAttendances) * cents(rate);
  const discountCents = cents(discount);

  if (discountCents >= grossCents) {
    return { accepted: false };
  }

  return {
    accepted: true,
    gross: formatCents(grossCents),
    discount: formatCents(discountCents),
    net: formatCents(grossCents - discountCents),
  };
}

export type PayrollPaymentResult = { accepted: false } | { accepted: true; amount: string };

/** El pago de una planilla: redondeado como su columna, debe ser exactamente el neto guardado. */
export function checkPayrollPayment({
  net,
  amount,
}: {
  net: AmountValue;
  amount: AmountValue;
}): PayrollPaymentResult {
  const amountCents = cents(amount);

  if (amountCents !== cents(net)) {
    return { accepted: false };
  }

  return { accepted: true, amount: formatCents(amountCents) };
}
