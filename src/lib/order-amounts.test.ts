import { describe, expect, it } from "vitest";

import { calculateOrderAmounts, calculateOrderLine } from "@/lib/order-amounts";

// Valores esperados calculados por Postgres (PGlite, 10.4c): cada cantidad y
// precio redondeados como sus columnas, numeric(10,2) y numeric(12,2), y el
// subtotal como numeric(12,2) del producto de los valores ya redondeados
// (tmp/e10-diff/e104c-demo/casos-importes.mjs).
describe("calculateOrderLine", () => {
  it.each([
    [1.25, 10.25, "1.25", "10.25", "12.81"],
    [1.25, 1.02, "1.25", "1.02", "1.28"],
    [3, 0.1, "3.00", "0.10", "0.30"],
    [1.005, 10, "1.01", "10.00", "10.10"],
    [2.675, 1, "2.68", "1.00", "2.68"],
    [0.125, 1, "0.13", "1.00", "0.13"],
    [1.5, 0.333, "1.50", "0.33", "0.50"],
    [2, 150, "2.00", "150.00", "300.00"],
    [1, 80.5, "1.00", "80.50", "80.50"],
    [0.005, 0.005, "0.01", "0.01", "0.00"],
    [1e-7, 5, "0.00", "5.00", "0.00"],
  ])("%s x %s redondea como la base", (cantidad, precio, cantidadGuardada, precioGuardado, subtotal) => {
    expect(calculateOrderLine({ cantidad, precio_unitario: precio })).toEqual({
      cantidad: cantidadGuardada,
      precio_unitario: precioGuardado,
      subtotal,
    });
  });

  it("redondea el decimal escrito, no el binario: 2.675 no es 2.67", () => {
    expect((2.675).toFixed(2)).toBe("2.67");
    expect(calculateOrderLine({ cantidad: 2.675, precio_unitario: 1 }).cantidad).toBe("2.68");
  });

  it("lee la notacion exponencial de los numeros grandes sin perder digitos", () => {
    expect(calculateOrderLine({ cantidad: 1e21, precio_unitario: 1 })).toEqual({
      cantidad: "1000000000000000000000.00",
      precio_unitario: "1.00",
      subtotal: "1000000000000000000000.00",
    });
  });

  it("acepta el texto de los campos del formulario", () => {
    expect(calculateOrderLine({ cantidad: "1.25", precio_unitario: "10.25" }).subtotal).toBe("12.81");
    expect(calculateOrderLine({ cantidad: " 2 ", precio_unitario: "150" }).subtotal).toBe("300.00");
  });

  it("un valor vacio o que no es un numero cuenta como cero en la vista previa", () => {
    expect(calculateOrderLine({ cantidad: "", precio_unitario: "10" })).toEqual({
      cantidad: "0.00",
      precio_unitario: "10.00",
      subtotal: "0.00",
    });
    expect(calculateOrderLine({ cantidad: "2", precio_unitario: "abc" }).subtotal).toBe("0.00");
    expect(calculateOrderLine({ cantidad: ".", precio_unitario: "-" }).subtotal).toBe("0.00");
    expect(calculateOrderLine({ cantidad: "1e999999", precio_unitario: "1" }).cantidad).toBe("0.00");
  });

  it("redondea la mitad lejos del cero tambien en negativos", () => {
    expect(calculateOrderLine({ cantidad: -1.005, precio_unitario: 1 })).toEqual({
      cantidad: "-1.01",
      precio_unitario: "1.00",
      subtotal: "-1.01",
    });
  });
});

describe("calculateOrderAmounts", () => {
  it("el monto es la suma de los subtotales ya redondeados (hallazgo 6 de la 10.4a)", () => {
    const amounts = calculateOrderAmounts([
      { cantidad: 1.25, precio_unitario: 10.25 },
      { cantidad: 1.25, precio_unitario: 10.25 },
    ]);

    // En coma flotante sin redondear: 25.625, que la base guarda como 25.63.
    expect(1.25 * 10.25 * 2).toBe(25.625);
    expect(amounts.total).toBe("25.62");
    expect(amounts.lines.map((line) => line.subtotal)).toEqual(["12.81", "12.81"]);
  });

  it("3 x 0.1 da 0.30 sin el error de coma flotante", () => {
    expect(calculateOrderAmounts([{ cantidad: 3, precio_unitario: 0.1 }]).total).toBe("0.30");
  });

  it("sin lineas el monto es cero", () => {
    expect(calculateOrderAmounts([])).toEqual({ lines: [], total: "0.00" });
  });
});
