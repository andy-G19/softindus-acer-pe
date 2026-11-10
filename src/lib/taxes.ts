/**
 * Porcentaje de IGV vigente en Perú. Este es el único lugar donde se define: lo consume
 * el cálculo de los montos de una compra (purchase-amounts.ts), que usan tanto el
 * formulario (vista previa) como el server action (cálculo autoritativo que se persiste).
 * Es un entero para calcular en centésimos sin coma flotante (11.2b).
 */
export const IGV_PERCENT = 18;

export const IGV_RATE_LABEL = `${IGV_PERCENT}%`;
