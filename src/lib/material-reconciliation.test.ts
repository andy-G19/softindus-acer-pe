import { describe, expect, it } from "vitest";

import {
  calculatePendingDelivery,
  calculateWaste,
  isOverDelivered,
  summarizeMaterialLine,
  validateClosure,
} from "@/lib/material-reconciliation";

describe("calculateWaste", () => {
  it("la merma es lo entregado que no se consumio ni volvio", () => {
    expect(calculateWaste({ delivered: 100, consumed: 95, returned: 3 })).toBe(2);
  });

  it("sin merma cuando todo se consumio", () => {
    expect(calculateWaste({ delivered: 100, consumed: 100, returned: 0 })).toBe(0);
  });

  it("sin merma cuando todo volvio al almacen", () => {
    expect(calculateWaste({ delivered: 100, consumed: 0, returned: 100 })).toBe(0);
  });

  it("todo lo entregado es merma si no se declara nada", () => {
    expect(calculateWaste({ delivered: 12.36, consumed: 0, returned: 0 })).toBe(
      12.36,
    );
  });

  it("absorbe el ruido de coma flotante", () => {
    // 12.36 - 12.3 - 0.06 da 1.7763568394002505e-15 en aritmetica de punto flotante.
    expect(
      calculateWaste({ delivered: 12.36, consumed: 12.3, returned: 0.06 }),
    ).toBe(0);
  });

  it("devuelve negativo cuando lo declarado supera lo entregado", () => {
    // No se recorta a cero: un negativo es incoherente y debe verse. validateClosure lo
    // impide antes de llegar a la base.
    expect(calculateWaste({ delivered: 100, consumed: 90, returned: 20 })).toBe(
      -10,
    );
  });

  it("acepta Decimal de Prisma", () => {
    expect(
      calculateWaste({
        delivered: { toString: () => "50.00" },
        consumed: "48.00",
        returned: null,
      }),
    ).toBe(2);
  });
});

describe("validateClosure", () => {
  it("acepta un cierre coherente y devuelve la merma", () => {
    const result = validateClosure({
      delivered: 100,
      consumed: 95,
      returned: 3,
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.waste).toBe(2);
    }
  });

  it("acepta consumir exactamente lo entregado", () => {
    expect(
      validateClosure({ delivered: 12.36, consumed: 12.36, returned: 0 }).ok,
    ).toBe(true);
  });

  it("rechaza declarar mas de lo entregado", () => {
    const result = validateClosure(
      { delivered: 100, consumed: 90, returned: 20 },
      "barras de acero",
    );

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.error).toContain("barras de acero");
      expect(result.error).toContain("supera lo entregado");
    }
  });

  it("rechaza devolver mas de lo entregado aunque no se consuma nada", () => {
    expect(
      validateClosure({ delivered: 10, consumed: 0, returned: 15 }).ok,
    ).toBe(false);
  });

  it("acepta un cierre sin entregas: todo en cero", () => {
    expect(validateClosure({ delivered: 0, consumed: 0, returned: 0 }).ok).toBe(
      true,
    );
  });

  it("no rechaza por ruido de coma flotante en el limite", () => {
    // Consumir exactamente lo entregado, con decimales que no son representables en
    // binario, no debe interpretarse como exceso.
    expect(
      validateClosure({ delivered: 12.36, consumed: 12.3, returned: 0.06 }).ok,
    ).toBe(true);
  });
});

describe("calculatePendingDelivery", () => {
  it("todo pendiente si no se entrego nada", () => {
    expect(calculatePendingDelivery({ required: 12.36, delivered: 0 })).toBe(
      12.36,
    );
  });

  it("nada pendiente si se entrego lo justo", () => {
    expect(
      calculatePendingDelivery({ required: 12.36, delivered: 12.36 }),
    ).toBe(0);
  });

  it("nada pendiente si se entrego de mas, sin negativos", () => {
    expect(calculatePendingDelivery({ required: 10, delivered: 15 })).toBe(0);
  });

  it("pendiente parcial tras una entrega incompleta", () => {
    expect(calculatePendingDelivery({ required: 100, delivered: 40 })).toBe(60);
  });
});

describe("isOverDelivered", () => {
  it("detecta la entrega adicional por encima del plan", () => {
    expect(isOverDelivered({ required: 10, delivered: 15 })).toBe(true);
  });

  it("entregar lo justo no es entregar de mas", () => {
    expect(isOverDelivered({ required: 12.36, delivered: 12.36 })).toBe(false);
  });

  it("entregar de menos no es entregar de mas", () => {
    expect(isOverDelivered({ required: 10, delivered: 4 })).toBe(false);
  });
});

describe("summarizeMaterialLine", () => {
  it("resume una linea entregada y cerrada", () => {
    const summary = summarizeMaterialLine({
      required: 100,
      delivered: 100,
      returned: 3,
      consumed: 95,
    });

    expect(summary).toEqual({
      required: 100,
      delivered: 100,
      returned: 3,
      consumed: 95,
      waste: 2,
      pendingDelivery: 0,
      overDelivered: false,
    });
  });

  it("resume una linea con entrega adicional", () => {
    const summary = summarizeMaterialLine({
      required: 10,
      delivered: 14,
      returned: 0,
      consumed: 14,
    });

    expect(summary.overDelivered).toBe(true);
    expect(summary.pendingDelivery).toBe(0);
    expect(summary.waste).toBe(0);
  });

  it("resume una linea sin entregar", () => {
    const summary = summarizeMaterialLine({
      required: 20400,
      delivered: 0,
      returned: 0,
      consumed: 0,
    });

    expect(summary.pendingDelivery).toBe(20400);
    expect(summary.waste).toBe(0);
    expect(summary.overDelivered).toBe(false);
  });
});
