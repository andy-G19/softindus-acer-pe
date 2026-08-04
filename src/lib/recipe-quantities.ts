/**
 * Cálculo de requerimiento de material a partir de una receta.
 *
 * La fórmula estaba duplicada en tres páginas (`details`, `requirements` y el detalle de
 * orden de trabajo) más dos server actions. Un solo lugar evita que las copias se separen
 * en silencio, que es lo que suele pasar cuando alguien ajusta la merma en una pantalla y
 * olvida el resto.
 *
 * Función pura: sin Prisma y sin `server-only`.
 */

/** Los Decimal de Prisma llegan como objeto con `toString()`, no como número nativo. */
type NumericInput = number | string | { toString(): string } | null | undefined;

function toNonNegativeNumber(value: NumericInput) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = typeof value === "number" ? value : Number(value.toString());

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

/**
 * Redondeo a 2 decimales, la precisión de las columnas Decimal(10, 2).
 *
 * El `=== 0 ? 0` no es redundante: normaliza el cero negativo. Una resta como
 * `12.36 - 12.3 - 0.06` da `-1.77e-15`, que al redondear produce `-0`, y `(-0).toFixed(2)`
 * se muestra como `"-0.00"`. Sin esta normalización, una conciliación exacta aparecería
 * en pantalla con una merma negativa.
 */
export function roundQuantity(value: number) {
  const rounded = Number(value.toFixed(2));

  return rounded === 0 ? 0 : rounded;
}

/**
 * Aplica el porcentaje de merma a una cantidad ya calculada.
 *
 * La merma es el material que se pierde en el proceso, así que **aumenta** lo que hay que
 * entregar: para obtener 100 kg útiles con 5% de merma hay que sacar 105 del almacén.
 */
export function applyWaste(
  baseQuantity: NumericInput,
  wastePercentage: NumericInput,
) {
  const base = toNonNegativeNumber(baseQuantity);
  const waste = toNonNegativeNumber(wastePercentage);

  return base * (1 + waste / 100);
}

/**
 * Requerimiento total de un material para una orden.
 *
 * `quantityPerUnit` es el consumo estándar para fabricar UNA unidad del producto, tal como
 * se captura en la versión de receta.
 */
export function calculateRequiredQuantity(params: {
  quantityPerUnit: NumericInput;
  wastePercentage: NumericInput;
  orderQuantity: NumericInput;
}) {
  const perUnit = toNonNegativeNumber(params.quantityPerUnit);
  const orderQuantity = toNonNegativeNumber(params.orderQuantity);

  return applyWaste(perUnit * orderQuantity, params.wastePercentage);
}

/** Igual que `calculateRequiredQuantity`, redondeado para persistir o mostrar. */
export function calculateRequiredQuantityRounded(params: {
  quantityPerUnit: NumericInput;
  wastePercentage: NumericInput;
  orderQuantity: NumericInput;
}) {
  return roundQuantity(calculateRequiredQuantity(params));
}
