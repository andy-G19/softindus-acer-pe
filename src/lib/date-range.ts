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

/**
 * El valor que conserva un input type="date": "aaaa-mm-dd" con una fecha que
 * existe. Cualquier otro ("2026-7-5", "2026-02-30") lo deja vacio el
 * navegador, asi que un rango no se valida con el (entrega 10.2).
 */
export function toDateInputValue(value: string | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");

  if (!match) {
    return "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const exists = year > 0 && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return exists ? match[0] : "";
}

/**
 * El valor de un input type="datetime-local": "aaaa-mm-ddThh:mm", con segundos
 * opcionales, de una fecha que existe y una hora valida (entrega 10.5b).
 */
export function isDateTimeInputValue(value: string) {
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.exec(value);

  return Boolean(match && toDateInputValue(match[1]));
}
