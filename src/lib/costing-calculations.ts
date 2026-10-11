/**
 * Calculo del costeo: estimado de materiales, precio sugerido y rentabilidad.
 *
 * Las formulas estaban repetidas entre el detalle de costeo, que las muestra como
 * referencia y vista previa, y las acciones que guardan el costeo, el margen y la
 * rentabilidad. Un solo lugar evita que la vista previa y lo que se guarda se separen en
 * silencio.
 *
 * Funciones puras: sin Prisma y sin `server-only`. Reciben numeros ya convertidos, y la
 * vista previa y la accion de cada formula convierten igual: el estimado de materiales,
 * en el desglose del detalle y en la generacion del costeo, con `toNonNegativeNumber`
 * (H6: el desglose usaba `toNumber` y con un negativo mostraba un costo que no se
 * guarda); el precio sugerido y la rentabilidad, con `toNumber`.
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
 *
 * La alerta compara el margen real redondeado a dos decimales (H7): es la escala con la
 * que se guarda (`rentabilidad.margen_real`, Decimal(5, 2)) y con la que se muestra
 * (`formatCostingPercent`). Comparar el doble sin redondear marcaba como margen bajo un
 * margen que se guarda y se ve como 20.00 %. `toFixed` redondea el valor binario y
 * Postgres el decimal: solo difieren en un empate exacto en el tercer decimal.
 * `realMargin` se devuelve sin redondear, como se guarda.
 */
export function calculateProfitability({
  income,
  totalCost,
  expectedMargin,
}: ProfitabilityInput) {
  const profit = income - totalCost;
  const realMargin = (profit / totalCost) * 100;
  const lowMarginAlert = Number(realMargin.toFixed(2)) < expectedMargin;

  return { profit, realMargin, lowMarginAlert };
}
