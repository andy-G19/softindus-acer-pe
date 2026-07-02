export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export function parseStringParam(
  params: SearchParamsRecord,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
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
