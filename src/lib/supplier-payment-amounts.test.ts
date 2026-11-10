import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  calculatePurchaseBalance,
  calculateSupplierPayment,
} from "@/lib/supplier-payment-amounts";

const D = (value: string) => new Prisma.Decimal(value);

describe("calculatePurchaseBalance", () => {
  it("resta en centesimos: 10.04 + 0.03 pagan exactamente 10.07", () => {
    expect(calculatePurchaseBalance(D("10.07"), [D("10.04"), D("0.03")])).toEqual({
      totalPaid: "10.07",
      balance: "0.00",
    });
  });

  it("100.30 con un pago de 50.10 deja 50.20, no 50.199999999999996", () => {
    expect(calculatePurchaseBalance(D("100.30"), [D("50.10")])).toEqual({
      totalPaid: "50.10",
      balance: "50.20",
    });
  });

  it("sin pagos el saldo es el total", () => {
    expect(calculatePurchaseBalance(D("1234.56"), [])).toEqual({
      totalPaid: "0.00",
      balance: "1234.56",
    });
  });

  it("pagos por encima del total dan un saldo negativo, como antes", () => {
    expect(calculatePurchaseBalance("100", ["60", "50"])).toEqual({
      totalPaid: "110.00",
      balance: "-10.00",
    });
  });
});

describe("calculateSupplierPayment", () => {
  it("acepta el saldo exacto y deja la compra pagada", () => {
    expect(
      calculateSupplierPayment({ total: D("100.30"), previousPayments: [D("50.10")], amount: 50.2 }),
    ).toEqual({ accepted: true, amount: "50.20", newBalance: "0.00", status: "pagado" });
  });

  it("un ultimo pago de 34.23 sobre 1234.56 no deja residuo", () => {
    expect(
      calculateSupplierPayment({
        total: D("1234.56"),
        previousPayments: [D("1000.11"), D("200.22")],
        amount: 34.23,
      }),
    ).toEqual({ accepted: true, amount: "34.23", newBalance: "0.00", status: "pagado" });
  });

  it("rechaza un centimo de mas y devuelve el saldo exacto", () => {
    expect(
      calculateSupplierPayment({ total: D("100.30"), previousPayments: [D("50.10")], amount: 50.21 }),
    ).toEqual({ accepted: false, balance: "50.20" });
  });

  it("un pago menor que el saldo deja la compra parcial", () => {
    expect(
      calculateSupplierPayment({ total: D("100.00"), previousPayments: [], amount: 40 }),
    ).toEqual({ accepted: true, amount: "40.00", newBalance: "60.00", status: "parcial" });
  });

  it("el monto se redondea como la columna antes de compararlo: 50.205 es 50.21", () => {
    expect(
      calculateSupplierPayment({ total: D("100.30"), previousPayments: [D("50.10")], amount: 50.205 }),
    ).toEqual({ accepted: false, balance: "50.20" });
  });

  it("50.204 se guarda 50.20 y salda la compra", () => {
    expect(
      calculateSupplierPayment({ total: D("100.30"), previousPayments: [D("50.10")], amount: 50.204 }),
    ).toEqual({ accepted: true, amount: "50.20", newBalance: "0.00", status: "pagado" });
  });

  // Hallazgo 6 de la 11.2a: el esquema acepta cualquier positivo y la columna
  // guarda 0.00. La funcion no cambia el saldo ni el estado; rechazar el monto
  // es tarea del esquema.
  it("un monto que redondea a cero no cambia el saldo ni el estado", () => {
    expect(
      calculateSupplierPayment({ total: D("100.00"), previousPayments: [], amount: 0.004 }),
    ).toEqual({ accepted: true, amount: "0.00", newBalance: "100.00", status: "pendiente" });
  });

  it("con un saldo negativo rechaza cualquier pago", () => {
    expect(
      calculateSupplierPayment({ total: "100", previousPayments: ["60", "50"], amount: 0.01 }),
    ).toEqual({ accepted: false, balance: "-10.00" });
  });
});
