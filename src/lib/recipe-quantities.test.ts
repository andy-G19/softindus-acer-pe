import { describe, expect, it } from "vitest";

import {
  applyWaste,
  calculateRequiredQuantity,
  calculateRequiredQuantityRounded,
  roundQuantity,
} from "@/lib/recipe-quantities";

describe("applyWaste", () => {
  it("sin merma devuelve la cantidad base", () => {
    expect(applyWaste(100, 0)).toBe(100);
    expect(applyWaste(100, null)).toBe(100);
  });

  it("la merma aumenta lo que hay que sacar del almacen", () => {
    // Para obtener 100 utiles con 5% de perdida hay que entregar 105.
    expect(applyWaste(100, 5)).toBe(105);
  });

  it("acepta Decimal de Prisma", () => {
    // toBeCloseTo y no toBe: 50 * 1.1 da 55.00000000000001 en coma flotante. Las
    // primitivas se mantienen exactas a proposito; redondear es responsabilidad de quien
    // persiste o compara, para eso estan roundQuantity y la variante ...Rounded.
    expect(applyWaste({ toString: () => "50" }, "10")).toBeCloseTo(55, 10);
  });

  it("la variante redondeada absorbe el ruido de coma flotante", () => {
    // Importa de verdad: comparar stock disponible contra un requerimiento con ruido
    // puede reportar faltante cuando el stock alcanza justo.
    expect(
      roundQuantity(applyWaste({ toString: () => "50" }, "10")),
    ).toBe(55);
  });

  it("trata negativos como cero", () => {
    expect(applyWaste(-10, 5)).toBe(0);
    expect(applyWaste(100, -5)).toBe(100);
  });
});

describe("calculateRequiredQuantity", () => {
  it("multiplica el consumo por unidad por la cantidad de la orden", () => {
    expect(
      calculateRequiredQuantity({
        quantityPerUnit: 2.5,
        wastePercentage: 0,
        orderQuantity: 10,
      }),
    ).toBe(25);
  });

  it("aplica la merma sobre el total de la orden", () => {
    // Ejemplo del requerimiento: 2.5 kg por unidad, 10 unidades, 5% de merma.
    expect(
      calculateRequiredQuantity({
        quantityPerUnit: 2.5,
        wastePercentage: 5,
        orderQuantity: 10,
      }),
    ).toBe(26.25);
  });

  it("una orden de cero unidades no requiere material", () => {
    expect(
      calculateRequiredQuantity({
        quantityPerUnit: 2.5,
        wastePercentage: 5,
        orderQuantity: 0,
      }),
    ).toBe(0);
  });

  it("es equivalente aplicar la merma antes o despues de multiplicar", () => {
    // Propiedad que justifica que el orden de operaciones no importe: la merma es
    // proporcional, asi que el resultado no depende de donde se aplique.
    const perUnitConMerma = applyWaste(2.5, 5) * 10;

    expect(
      calculateRequiredQuantity({
        quantityPerUnit: 2.5,
        wastePercentage: 5,
        orderQuantity: 10,
      }),
    ).toBeCloseTo(perUnitConMerma, 10);
  });
});

describe("roundQuantity", () => {
  it("redondea a dos decimales", () => {
    expect(roundQuantity(26.256)).toBe(26.26);
    expect(roundQuantity(1 / 3)).toBe(0.33);
  });
});

describe("calculateRequiredQuantityRounded", () => {
  it("redondea el requerimiento calculado", () => {
    expect(
      calculateRequiredQuantityRounded({
        quantityPerUnit: 0.333,
        wastePercentage: 7,
        orderQuantity: 3,
      }),
    ).toBe(1.07);
  });
});
