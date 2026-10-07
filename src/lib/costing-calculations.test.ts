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
