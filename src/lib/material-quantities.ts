import { formatCents, toCents } from "@/lib/decimal-cents";
import { calculatePendingDelivery } from "@/lib/material-reconciliation";
import type { NumericInput } from "@/lib/numbers";
import type { AmountValue } from "@/lib/supplier-payment-amounts";

/**
 * Cantidades de material de una orden de trabajo (C1 de la 11.6a, D62).
 *
 * `material.stock_actual` y las cantidades del requerimiento congelado y del kardex son
 * numeric(10, 2). Las acciones mandaban la cantidad escrita sin redondear al `decrement`, al
 * `increment` y al kardex, y cada columna la redondeaba por su lado: una entrega de 0.005 dejaba
 * el stock en 20.00 mientras el kardex anotaba una salida de 0.01 desde un stock de 20.01. Ahora
 * la cantidad se redondea en centesimos enteros sobre el decimal escrito (decimal-cents.ts), como
 * la salida de inventario (11.2c), antes de compararla y de escribirla: lo que se manda es lo que
 * se guarda.
 *
 * Funciones puras, sin Prisma ni `server-only`.
 */

/** Centesimos de una cantidad, redondeados como su columna numeric(10, 2). */
export function quantityHundredths(value: AmountValue) {
  // Un Decimal de Prisma se lee por su texto, el mismo que guarda la base; un valor que no es un
  // numero no llega aqui porque el esquema lo rechaza.
  return toCents(String(value)) ?? 0n;
}

/** La cantidad como la guarda su columna, en texto con dos decimales. */
export function roundMaterialQuantity(value: AmountValue) {
  return formatCents(quantityHundredths(value));
}

/**
 * Lo que falta entregar de una linea del requerimiento, como lo entrega la accion: redondeado como
 * su columna. La confirmacion de «Entregar lo pendiente» lo muestra con esta misma funcion (C3 de
 * la 11.6b, D75), asi que dice lo que sale del almacen; una linea en 0.00 no se entrega.
 */
export function pendingDeliveryQuantity(params: { required: NumericInput; delivered: NumericInput }) {
  return roundMaterialQuantity(calculatePendingDelivery(params));
}
