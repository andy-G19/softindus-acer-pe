/**
 * Tasa de IGV vigente en Perú. Este es el único lugar donde se define el
 * porcentaje: lo consumen tanto el formulario de compra (cálculo en vivo)
 * como el server action (cálculo autoritativo que se persiste).
 */
export const IGV_RATE = 0.18;

export const IGV_RATE_LABEL = "18%";

/**
 * IGV correspondiente a un subtotal, redondeado a 2 decimales para que
 * coincida con la precisión de las columnas Decimal(12, 2).
 */
export function calculateIgv(subtotal: number) {
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return 0;
  }

  return Number((subtotal * IGV_RATE).toFixed(2));
}
