import { describe, expect, it } from "vitest";

import { divideRounded, formatCents, multiplyCents, toCents } from "@/lib/decimal-cents";

// El nucleo de los importes de pedidos y reparaciones. Los valores de cada
// regla salen de Postgres en src/lib/order-amounts.test.ts y
// src/lib/repair-amounts.test.ts; aqui, solo el contrato de cada funcion.
describe("decimal-cents", () => {
  it("toCents redondea el decimal escrito con la mitad lejos del cero", () => {
    expect(toCents("2.675")).toBe(268n);
    expect(toCents(1.005)).toBe(101n);
    expect(toCents("-0.005")).toBe(-1n);
    expect(toCents(1e21)).toBe(100000000000000000000000n);
  });

  it("toCents da cero con un valor vacio y null si no es un numero", () => {
    expect(toCents("")).toBe(0n);
    expect(toCents("abc")).toBeNull();
    expect(toCents("1e999")).toBeNull();
  });

  it("divideRounded redondea la mitad lejos del cero", () => {
    expect(divideRounded(5n, 10n)).toBe(1n);
    expect(divideRounded(4n, 10n)).toBe(0n);
    expect(divideRounded(-5n, 10n)).toBe(-1n);
  });

  it("multiplyCents vuelve a centesimos redondeando", () => {
    expect(multiplyCents(125n, 1025n)).toBe(1281n);
    expect(multiplyCents(101n, 1025n)).toBe(1035n);
  });

  it("formatCents siempre escribe dos decimales", () => {
    expect(formatCents(0n)).toBe("0.00");
    expect(formatCents(5n)).toBe("0.05");
    expect(formatCents(-1281n)).toBe("-12.81");
  });
});
