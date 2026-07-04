export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numericValue = Number(value.toString());

  return Number.isNaN(numericValue) ? 0 : numericValue;
}
