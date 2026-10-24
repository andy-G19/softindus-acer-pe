export type SearchParamsRecord = Record<string, string | string[] | undefined>;

// Limite defensivo para parametros de texto libre (busqueda, filtros): evita
// que un query string absurdamente largo llegue a construir un WHERE de
// Prisma con un `contains` gigante.
const MAX_TEXT_PARAM_LENGTH = 200;

export function parseStringParam(
  params: SearchParamsRecord,
  key: string,
) {
  const value = params[key];
  const single = Array.isArray(value) ? value[0] : value;

  return single?.trim().slice(0, MAX_TEXT_PARAM_LENGTH) ?? "";
}

export function parseDateParam(
  params: SearchParamsRecord,
  key: string,
) {
  const value = parseStringParam(params, key);

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

// Rango de un filtro de listado: desde el inicio del primer dia hasta antes del
// dia siguiente al ultimo, la regla de buildReportDateRange en los reportes.
// Con lte a las 23:59:59.999 se perdian los instantes del ultimo milisegundo
// del dia, porque timestamptz guarda microsegundos (hallazgo 6 de la 10.3a).
export function buildDateRangeFilter(
  from: Date | null,
  to: Date | null,
) {
  if (!from && !to) {
    return undefined;
  }

  const filter: { gte?: Date; lt?: Date } = {};

  if (from) {
    filter.gte = from;
  }

  if (to) {
    const nextDay = new Date(to);
    nextDay.setDate(nextDay.getDate() + 1);
    filter.lt = nextDay;
  }

  return filter;
}
