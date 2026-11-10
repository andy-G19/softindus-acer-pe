import { describe, expect, it } from "vitest";

import { calculatePurchaseAmounts } from "@/lib/purchase-amounts";

// Valores esperados con la regla de las columnas numeric(_, 2): cantidad y costo
// redondeados, subtotal de linea de los valores ya redondeados, subtotal de la compra como
// suma de lineas, IGV del 18 % redondeado y total = subtotal + IGV.
describe("calculatePurchaseAmounts", () => {
  it("hallazgo 1: dos lineas de 1.25 x 10.25 suman los subtotales guardados", () => {
    expect(
      calculatePurchaseAmounts({
        aplicaIgv: true,
        items: [
          { cantidad: 1.25, costo_unitario: 10.25 },
          { cantidad: "1.25", costo_unitario: "10.25" },
        ],
      }),
    ).toEqual({
      lines: [
        { cantidad: "1.25", costo_unitario: "10.25", subtotal: "12.81" },
        { cantidad: "1.25", costo_unitario: "10.25", subtotal: "12.81" },
      ],
      subtotal: "25.62",
      igv: "4.61",
      total: "30.23",
    });
  });

  it("hallazgo 2: el subtotal sale de la cantidad redondeada: 1.005 se guarda 1.01", () => {
    expect(
      calculatePurchaseAmounts({ aplicaIgv: false, items: [{ cantidad: 1.005, costo_unitario: 10 }] }),
    ).toEqual({
      lines: [{ cantidad: "1.01", costo_unitario: "10.00", subtotal: "10.10" }],
      subtotal: "10.10",
      igv: "0.00",
      total: "10.10",
    });
  });

  it("hallazgo 3: con montos pequenos el total sigue siendo subtotal + IGV", () => {
    expect(
      calculatePurchaseAmounts({ aplicaIgv: true, items: [{ cantidad: 0.5, costo_unitario: 0.15 }] }),
    ).toMatchObject({ subtotal: "0.08", igv: "0.01", total: "0.09" });
  });

  it("hallazgo 6: el costo se redondea como la columna: 10.255 es 10.26", () => {
    expect(
      calculatePurchaseAmounts({ aplicaIgv: false, items: [{ cantidad: 1, costo_unitario: 10.255 }] }).lines,
    ).toEqual([{ cantidad: "1.00", costo_unitario: "10.26", subtotal: "10.26" }]);
  });

  it("el IGV redondea la mitad lejos del cero: 18 % de 0.25 es 0.045, que es 0.05", () => {
    expect(
      calculatePurchaseAmounts({ aplicaIgv: true, items: [{ cantidad: 1, costo_unitario: 0.25 }] }),
    ).toMatchObject({ subtotal: "0.25", igv: "0.05", total: "0.30" });
  });

  it("sin IGV, el IGV es cero y el total es el subtotal", () => {
    expect(
      calculatePurchaseAmounts({ aplicaIgv: false, items: [{ cantidad: 3, costo_unitario: 12.5 }] }),
    ).toMatchObject({ subtotal: "37.50", igv: "0.00", total: "37.50" });
  });

  it("en la vista previa un campo vacio cuenta como cero", () => {
    expect(
      calculatePurchaseAmounts({ aplicaIgv: true, items: [{ cantidad: "", costo_unitario: "8" }] }),
    ).toMatchObject({ subtotal: "0.00", igv: "0.00", total: "0.00" });
  });

  it("sin lineas, todo es cero", () => {
    expect(calculatePurchaseAmounts({ aplicaIgv: true, items: [] })).toEqual({
      lines: [],
      subtotal: "0.00",
      igv: "0.00",
      total: "0.00",
    });
  });
});
