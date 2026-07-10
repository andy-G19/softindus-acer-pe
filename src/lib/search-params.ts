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

export function buildDateRangeFilter(
  from: Date | null,
  to: Date | null,
) {
  if (!from && !to) {
    return undefined;
  }

  const filter: { gte?: Date; lte?: Date } = {};

  if (from) {
    filter.gte = from;
  }

  if (to) {
    const endOfDay = new Date(to);
    endOfDay.setHours(23, 59, 59, 999);
    filter.lte = endOfDay;
  }

  return filter;
}
