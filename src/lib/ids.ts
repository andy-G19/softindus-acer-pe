export function buildNextId(prefix: string, lastId?: string | null) {
  if (prefix.length !== 3) {
    throw new Error("El prefijo debe tener exactamente 3 caracteres.");
  }

  if (!lastId) {
    return `${prefix}00000001`;
  }

  const numericPart = lastId.slice(3);
  const nextNumber = Number(numericPart) + 1;

  return `${prefix}${String(nextNumber).padStart(8, "0")}`;
}

export function buildNextIds(
  prefix: string,
  lastId: string | null | undefined,
  count: number
) {
  if (prefix.length !== 3) {
    throw new Error("El prefijo debe tener exactamente 3 caracteres.");
  }

  if (count < 1) {
    return [];
  }

  const lastNumber = lastId ? Number(lastId.slice(3)) : 0;

  return Array.from({ length: count }, (_, index) => {
    const nextNumber = lastNumber + index + 1;
    return `${prefix}${String(nextNumber).padStart(8, "0")}`;
  });
}