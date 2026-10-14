// Rango de fechas de los filtros (entrega 8). El mismo mensaje lo usan la
// validacion de la ruta de exportacion (validateDateRange) y la del navegador
// (DateRangeFields). Este modulo no importa nada: se puede usar en el cliente.

export const DATE_RANGE_INVERTED_MESSAGE =
  "La fecha inicial no puede ser mayor que la fecha final.";

/**
 * Fechas "aaaa-mm-dd" (el valor de un input type="date"): con ceros a la
 * izquierda, el orden del texto es el del calendario. Si falta un extremo, el
 * rango no esta invertido.
 */
export function isDateRangeInverted(from: string | undefined, to: string | undefined) {
  return Boolean(from && to && from > to);
}
