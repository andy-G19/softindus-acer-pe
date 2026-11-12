import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  calculateClientPayment,
  calculateQuoteAmounts,
  calculateQuoteTotal,
  checkReceiptAmount,
  hasCents,
} from "@/lib/client-payment-amounts";

// Montos de proforma y pago de cliente (C2 de la 11.3a) con los bordes del redondeo de las
// columnas numeric(12, 2): la mitad se redondea lejos del cero sobre el decimal escrito.

const D = (value: string) => new Prisma.Decimal(value);

describe("calculateQuoteTotal", () => {
  it("suma los subtotales guardados sin el error de number", () => {
    expect(calculateQuoteTotal([D("100.10"), D("200.20")])).toBe("300.30");
    expect(calculateQuoteTotal(["0.70", "0.10"])).toBe("0.80");
  });

  it("sin subtotales es cero", () => {
    expect(calculateQuoteTotal([])).toBe("0.00");
  });
});

describe("calculateQuoteAmounts", () => {
  it("sin adelanto: vigente, sin adelanto guardado y saldo igual al total", () => {
    expect(calculateQuoteAmounts({ subtotals: ["150.50"] })).toEqual({
      accepted: true,
      total: "150.50",
      advance: null,
      balance: "150.50",
      status: "vigente",
    });
    expect(calculateQuoteAmounts({ subtotals: ["150.50"], advance: 0 })).toMatchObject({ advance: null, status: "vigente" });
  });

  it("adelanto parcial: aceptada", () => {
    expect(calculateQuoteAmounts({ subtotals: ["10.00"], advance: "0.125" })).toEqual({
      accepted: true,
      total: "10.00",
      advance: "0.13",
      balance: "9.87",
      status: "aceptada",
    });
  });

  it("adelanto igual al total: pagada con saldo 0.00", () => {
    expect(calculateQuoteAmounts({ subtotals: [D("100.10"), D("200.20")], advance: 300.3 })).toMatchObject({
      advance: "300.30",
      balance: "0.00",
      status: "pagada",
    });
  });

  it("un adelanto que redondea al total tambien la deja pagada", () => {
    expect(calculateQuoteAmounts({ subtotals: ["10.01"], advance: "10.005" })).toMatchObject({
      advance: "10.01",
      balance: "0.00",
      status: "pagada",
    });
  });

  it("rechaza un adelanto mayor que el total, tambien por un centimo redondeado", () => {
    expect(calculateQuoteAmounts({ subtotals: ["10.00"], advance: "10.01" })).toEqual({
      accepted: false,
      reason: "adelanto_mayor",
    });
    expect(calculateQuoteAmounts({ subtotals: ["10.00"], advance: "10.005" })).toEqual({
      accepted: false,
      reason: "adelanto_mayor",
    });
  });

  it("rechaza un total de cero", () => {
    expect(calculateQuoteAmounts({ subtotals: ["0.00"] })).toEqual({ accepted: false, reason: "sin_total" });
  });
});

describe("calculateClientPayment", () => {
  it("pago parcial: aceptada con el saldo restado en centimos", () => {
    expect(calculateClientPayment({ balance: D("10.00"), amount: 0.125 })).toEqual({
      accepted: true,
      amount: "0.13",
      newBalance: "9.87",
      status: "aceptada",
    });
  });

  it("pago de todo el saldo: pagada", () => {
    expect(calculateClientPayment({ balance: D("300.30"), amount: "300.30" })).toEqual({
      accepted: true,
      amount: "300.30",
      newBalance: "0.00",
      status: "pagada",
    });
  });

  it("rechaza un pago mayor que el saldo y devuelve el saldo con dos decimales", () => {
    expect(calculateClientPayment({ balance: D("10"), amount: "10.005" })).toEqual({ accepted: false, balance: "10.00" });
  });
});

describe("hasCents", () => {
  it("cuenta lo que la columna guardaria como al menos 0.01", () => {
    expect([hasCents("0.005"), hasCents("0.004"), hasCents(0), hasCents(D("0.00")), hasCents(null), hasCents(undefined)]).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe("checkReceiptAmount", () => {
  it("acepta hasta el total, comparando lo que guarda la columna", () => {
    expect(checkReceiptAmount({ total: D("150.50"), amount: 150.5 })).toEqual({ accepted: true, amount: "150.50" });
    expect(checkReceiptAmount({ total: D("150.50"), amount: "150.504" })).toEqual({ accepted: true, amount: "150.50" });
    expect(checkReceiptAmount({ total: D("150.50"), amount: "100.125" })).toEqual({ accepted: true, amount: "100.13" });
  });

  it("rechaza lo que supera el total, tambien por un centimo redondeado", () => {
    expect(checkReceiptAmount({ total: D("150.50"), amount: "150.505" })).toEqual({ accepted: false });
    expect(checkReceiptAmount({ total: D("150.50"), amount: "150.51" })).toEqual({ accepted: false });
  });
});
