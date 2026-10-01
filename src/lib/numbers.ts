/**
 * Conversión numérica compartida.
 *
 * Sin `server-only`: la usan también componentes cliente y los formateadores.
 */

/** Los Decimal de Prisma llegan como objeto con `toString()`, no como número nativo. */
export type NumericInput =
  | number
  | string
  | { toString(): string }
  | null
  | undefined;

/**
 * Convierte un valor de Prisma (Decimal, number) a `number`; `null` y `undefined`
 * valen 0, porque un total sin registros es cero.
 *
 * No oculta los valores no numéricos: devuelve `NaN`, igual que `Number()`. Acepta
 * `unknown` porque hoy la llaman envoltorios locales con parámetros sin tipar.
 */
export function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

/**
 * Para cálculos que no admiten negativos (cantidades, costos, mermas): `null`,
 * un negativo o un valor no finito valen 0.
 */
export function toNonNegativeNumber(value: NumericInput) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value.toString());

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}
