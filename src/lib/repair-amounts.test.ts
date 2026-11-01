import { describe, expect, it } from "vitest";

import { calculateRepairAmounts } from "@/lib/repair-amounts";

// Valores esperados calculados por Postgres (PGlite, 10.5b): cantidad
// numeric(10,2), costo unitario, subtotal, mano de obra y costo total
// numeric(12,2); el subtotal, del producto de los valores ya redondeados, y el
// total, de la mano de obra redondeada mas los subtotales ya redondeados
// (tmp/e10-diff/e105b-demo/casos-reparacion.mjs).
describe("calculateRepairAmounts", () => {
  it("dos repuestos de 1.25 x 10.25 suman los subtotales guardados, no 25.63", () => {
    expect(
      calculateRepairAmounts({
        mano_obra: null,
        items: [
          { cantidad: 1.25, costo_unitario: "10.25" },
          { cantidad: 1.25, costo_unitario: "10.25" },
        ],
      }),
    ).toEqual({
      lines: [
        { cantidad: "1.25", costo_unitario: "10.25", subtotal: "12.81" },
        { cantidad: "1.25", costo_unitario: "10.25", subtotal: "12.81" },
      ],
      mano_obra: null,
      sparePartsTotal: "25.62",
      total: "25.62",
    });
  });

  it("el subtotal sale de la cantidad ya redondeada: 1.005 se guarda 1.01", () => {
    expect(
      calculateRepairAmounts({ mano_obra: 150.5, items: [{ cantidad: 1.005, costo_unitario: "10.25" }] }),
    ).toEqual({
      lines: [{ cantidad: "1.01", costo_unitario: "10.25", subtotal: "10.35" }],
      mano_obra: "150.50",
      sparePartsTotal: "10.35",
      total: "160.85",
    });
  });

  it("la mano de obra se redondea antes de sumarla al total", () => {
    expect(
      calculateRepairAmounts({ mano_obra: 0.005, items: [{ cantidad: 2.675, costo_unitario: "1.00" }] }),
    ).toEqual({
      lines: [{ cantidad: "2.68", costo_unitario: "1.00", subtotal: "2.68" }],
      mano_obra: "0.01",
      sparePartsTotal: "2.68",
      total: "2.69",
    });
  });

  it.each([
    [150.5, [[2, "10.25"], [1, "10.25"], [0.5, "38.90"]], "150.50", "50.20", "200.70"],
    [150.555, [], "150.56", "0.00", "150.56"],
    [null, [], null, "0.00", "0.00"],
    [0, [[1.15, "0.29"], [3, "0.10"]], "0.00", "0.63", "0.63"],
    [10.1, [[0.1, "0.70"], [0.2, "0.70"], [0.7, "0.10"]], "10.10", "0.28", "10.38"],
  ] as const)("mano de obra %s con %j", (mano_obra, lineas, manoObraGuardada, repuestos, total) => {
    const items = lineas.map(([cantidad, costo_unitario]) => ({ cantidad, costo_unitario }));

    expect(calculateRepairAmounts({ mano_obra, items })).toMatchObject({
      mano_obra: manoObraGuardada,
      sparePartsTotal: repuestos,
      total,
    });
  });

  it("acepta el texto de los campos del formulario", () => {
    expect(
      calculateRepairAmounts({ mano_obra: "150.50", items: [{ cantidad: " 2 ", costo_unitario: "10.25" }] }),
    ).toMatchObject({ mano_obra: "150.50", sparePartsTotal: "20.50", total: "171.00" });
  });

  it("una mano de obra vacia queda sin valor y cuenta cero en el total", () => {
    expect(
      calculateRepairAmounts({ mano_obra: "", items: [{ cantidad: "1", costo_unitario: "10" }] }),
    ).toMatchObject({ mano_obra: null, total: "10.00" });
  });

  it("un valor vacio o que no es un numero cuenta como cero en la vista previa", () => {
    expect(
      calculateRepairAmounts({
        mano_obra: "abc",
        items: [
          { cantidad: "", costo_unitario: "10" },
          { cantidad: "2", costo_unitario: "abc" },
        ],
      }),
    ).toEqual({
      lines: [
        { cantidad: "0.00", costo_unitario: "10.00", subtotal: "0.00" },
        { cantidad: "2.00", costo_unitario: "0.00", subtotal: "0.00" },
      ],
      mano_obra: "0.00",
      sparePartsTotal: "0.00",
      total: "0.00",
    });
  });
});
