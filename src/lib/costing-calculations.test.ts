import { describe, expect, it } from "vitest";

import {
  calculateProfitability,
  calculateSuggestedPrice,
  estimateMaterialCost,
} from "@/lib/costing-calculations";

// toBe y no toBeCloseTo a proposito: los montos se guardan tal como se
// calculan, asi que el ultimo decimal es parte del resultado. Los valores
// esperados son los que fijan los snapshots de las acciones de costos.

describe("estimateMaterialCost", () => {
  it("aplica la merma sobre el requerimiento base y valoriza al costo unitario", () => {
    expect(
      estimateMaterialCost({
        quantityToProduce: 25,
        quantityPerUnit: 2.5,
        wastePercentage: 10,
        unitCost: 12.47,
      }),
    ).toEqual({ requiredBase: 62.5, requiredWithWaste: 68.75, estimatedCost: 857.3125 });
  });

  it("sin merma, el requerimiento con merma es el base", () => {
    expect(
      estimateMaterialCost({
        quantityToProduce: 25,
        quantityPerUnit: 0.75,
        wastePercentage: 0,
        unitCost: 48.3,
      }),
    ).toEqual({ requiredBase: 18.75, requiredWithWaste: 18.75, estimatedCost: 905.625 });
  });

  it("conserva el orden de las operaciones de la merma", () => {
    const { requiredWithWaste } = estimateMaterialCost({
      quantityToProduce: 3,
      quantityPerUnit: 0.25,
      wastePercentage: 2.5,
      unitCost: 6.4,
    });

    // 0.75 * 1.025; aplicar la merma como 0.75 + 0.75 * 2.5 / 100 da 0.76875.
    expect(requiredWithWaste).toBe(0.7687499999999999);
  });

  it("no recorta negativos: la conversion la decide quien llama", () => {
    expect(
      estimateMaterialCost({
        quantityToProduce: 2,
        quantityPerUnit: -1.5,
        wastePercentage: 10,
        unitCost: 4,
      }).estimatedCost,
    ).toBeCloseTo(-13.2, 12);
  });
});

describe("calculateSuggestedPrice", () => {
  it("aplica el margen sobre el costo total", () => {
    expect(calculateSuggestedPrice(1524.58, 17)).toBe(1783.7586);
    expect(calculateSuggestedPrice(1000, 15)).toBe(1150);
  });

  it("conserva el orden de las operaciones", () => {
    // 1001.37 * 1.17; 1001.37 + 1001.37 * 17 / 100 da 1171.6029.
    expect(calculateSuggestedPrice(1001.37, 17)).toBe(1171.6028999999999);
  });
});

describe("calculateProfitability", () => {
  it("bajo el margen esperado hay alerta", () => {
    expect(
      calculateProfitability({ income: 1700, totalCost: 1524.58, expectedMargin: 18 }),
    ).toEqual({
      profit: 175.42000000000007,
      realMargin: 11.506119718217482,
      lowMarginAlert: true,
    });
  });

  it("un margen real igual al esperado no es margen bajo", () => {
    expect(
      calculateProfitability({ income: 1180, totalCost: 1000, expectedMargin: 18 }),
    ).toEqual({ profit: 180, realMargin: 18, lowMarginAlert: false });
  });

  it("conserva el orden de las operaciones del margen real", () => {
    // (utilidad / costo) * 100; multiplicar antes de dividir da 13.322756542722678.
    expect(
      calculateProfitability({ income: 1700, totalCost: 1500.14, expectedMargin: 18 })
        .realMargin,
    ).toBe(13.322756542722672);
  });

  it("no protege el costo cero: lo decide quien llama", () => {
    expect(
      calculateProfitability({ income: 100, totalCost: 0, expectedMargin: 18 }),
    ).toEqual({ profit: 100, realMargin: Infinity, lowMarginAlert: false });
  });
});

// H7 (grupo 2 de fixes): la alerta comparaba el margen real en coma flotante,
// pero margen_real se guarda como Decimal(5, 2) y la pantalla lo muestra con
// dos decimales. Un margen que se guarda y se ve como 20.00 % quedaba marcado
// como margen bajo. El margen real se sigue devolviendo sin redondear: es el
// valor que se guarda y Postgres lo redondea al escribirlo.
describe("calculateProfitability: la alerta usa el margen que se guarda y se muestra (H7)", () => {
  it("un margen real a 1e-14 del esperado no es margen bajo (COS00000001 en staging)", () => {
    expect(
      calculateProfitability({ income: 1817.04, totalCost: 1514.2, expectedMargin: 20 }),
    ).toEqual({
      profit: 302.8399999999999,
      realMargin: 19.999999999999993,
      lowMarginAlert: false,
    });
  });

  it("el precio sugerido redondeado al centimo no dispara la alerta", () => {
    // 1000.01 * 1.17 = 1170.0117, que se guarda como 1170.01.
    const result = calculateProfitability({
      income: 1170.01,
      totalCost: 1000.01,
      expectedMargin: 17,
    });

    expect(result.realMargin).toBe(16.999830001699983);
    expect(result.lowMarginAlert).toBe(false);
  });

  it("un margen de 16.996 % se guarda y se muestra como 17.00 %: no es margen bajo", () => {
    // Distingue el redondeo a dos decimales del redondeo a tres (16.996).
    const result = calculateProfitability({ income: 292.49, totalCost: 250, expectedMargin: 17 });

    expect(result.realMargin).toBe(16.996000000000002);
    expect(result.lowMarginAlert).toBe(false);
  });

  it("un margen de 16.992 % se muestra como 16.99 %: sigue siendo margen bajo", () => {
    const result = calculateProfitability({ income: 292.48, totalCost: 250, expectedMargin: 17 });

    expect(result.realMargin).toBe(16.992000000000008);
    expect(result.lowMarginAlert).toBe(true);
  });
});
