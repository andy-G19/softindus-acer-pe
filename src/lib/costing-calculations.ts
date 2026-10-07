/**
 * Calculo del costeo: estimado de materiales, precio sugerido y rentabilidad.
 *
 * Las formulas estaban repetidas entre el detalle de costeo, que las muestra como
 * referencia y vista previa, y las acciones que guardan el costeo, el margen y la
 * rentabilidad. Un solo lugar evita que la vista previa y lo que se guarda se separen en
 * silencio.
 *
 * Funciones puras: sin Prisma y sin `server-only`. Reciben numeros ya convertidos porque
 * cada llamador convierte a su manera: el detalle con `toNumber` y las acciones con
 * `toNonNegativeNumber`. Por eso no se usa `applyWaste` de recipe-quantities, que
 * convierte los negativos a cero: cambiaria lo que muestra el detalle.
 *
 * El orden de las operaciones es parte del contrato. `b * (1 + w / 100)` y
 * `b + b * w / 100` son iguales en algebra, pero no siempre dan el mismo numero en coma
 * flotante, y los montos se guardan tal como se calculan.
 */

export type MaterialCostInput = {
  /** Unidades de la orden. */
  quantityToProduce: number;
  /** Consumo estandar de la receta para una unidad. */
  quantityPerUnit: number;
  wastePercentage: number;
  unitCost: number;
};

/** Requerimiento base, requerimiento con merma y costo estimado de un material. */
export function estimateMaterialCost({
  quantityToProduce,
  quantityPerUnit,
  wastePercentage,
  unitCost,
}: MaterialCostInput) {
  const requiredBase = quantityPerUnit * quantityToProduce;
  const requiredWithWaste = requiredBase * (1 + wastePercentage / 100);
  const estimatedCost = requiredWithWaste * unitCost;

  return { requiredBase, requiredWithWaste, estimatedCost };
}

/** Precio que resulta de aplicar el margen sobre el costo total. */
export function calculateSuggestedPrice(totalCost: number, marginPercentage: number) {
  return totalCost * (1 + marginPercentage / 100);
}

export type ProfitabilityInput = {
  income: number;
  totalCost: number;
  /** Margen aplicado, en porcentaje: por debajo de el hay alerta. */
  expectedMargin: number;
};

/**
 * Utilidad, margen real sobre el costo y alerta de bajo margen.
 *
 * No protege el costo cero: con costo cero el margen real es infinito o NaN. Cada
 * llamador decide antes: la accion rechaza el calculo y la vista previa del detalle
 * muestra ceros con la alerta.
 */
export function calculateProfitability({
  income,
  totalCost,
  expectedMargin,
}: ProfitabilityInput) {
  const profit = income - totalCost;
  const realMargin = (profit / totalCost) * 100;
  const lowMarginAlert = realMargin < expectedMargin;

  return { profit, realMargin, lowMarginAlert };
}
