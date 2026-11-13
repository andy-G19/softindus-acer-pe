import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { checkCashWithdrawal, roundCashAmount } from "@/lib/petty-cash-amounts";

// C2 de la 11.4a (D43): montos de caja chica redondeados como numeric(12, 2), la mitad lejos del
// cero, sobre el decimal escrito.
describe("roundCashAmount", () => {
  it.each([
    [40.005, "40.01"],
    ["60.505", "60.51"],
    [2.675, "2.68"],
    [100, "100.00"],
    ["0.004", "0.00"],
  ])("%s se guarda como %s", (amount, expected) => {
    expect(roundCashAmount(amount)).toBe(expected);
  });
});

describe("checkCashWithdrawal", () => {
  const balance = new Prisma.Decimal("100.00");

  it("acepta todo el saldo, tambien escrito con un milesimo de mas que se pierde al guardar", () => {
    expect(checkCashWithdrawal({ balance, amount: 100 })).toEqual({ accepted: true, amount: "100.00" });
    expect(checkCashWithdrawal({ balance, amount: 100.004 })).toEqual({ accepted: true, amount: "100.00" });
  });

  it("rechaza lo que se guardaria por encima del saldo, con el saldo para el mensaje", () => {
    expect(checkCashWithdrawal({ balance, amount: 100.005 })).toEqual({ accepted: false, balance: "100.00" });
    expect(checkCashWithdrawal({ balance: new Prisma.Decimal("0.30"), amount: 0.31 })).toEqual({
      accepted: false,
      balance: "0.30",
    });
  });

  it("devuelve el monto redondeado que se descuenta", () => {
    expect(checkCashWithdrawal({ balance, amount: 40.005 })).toEqual({ accepted: true, amount: "40.01" });
    expect(checkCashWithdrawal({ balance: new Prisma.Decimal("0.30"), amount: "0.1" })).toEqual({
      accepted: true,
      amount: "0.10",
    });
  });
});
