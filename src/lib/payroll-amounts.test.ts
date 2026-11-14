import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { calculatePayrollAmounts, checkPayrollPayment } from "@/lib/payroll-amounts";

// Montos de planilla y pago (C2 de la 11.5, D53): en centesimos, con el redondeo de las columnas.

describe("calculatePayrollAmounts", () => {
  it.each([
    [2, "50.00", 10, "100.00", "10.00", "90.00"],
    [2, "50.00", 10.005, "100.00", "10.01", "89.99"],
    [2, "50.00", 0.125, "100.00", "0.13", "99.87"],
    [2, "50.00", 1.005, "100.00", "1.01", "98.99"],
    [2, "50.00", 0, "100.00", "0.00", "100.00"],
    [3, "33.33", 0, "99.99", "0.00", "99.99"],
    [3, new Prisma.Decimal("33.33"), "0.01", "99.99", "0.01", "99.98"],
    // El menor neto posible: un centimo.
    [2, "50.00", 99.99, "100.00", "99.99", "0.01"],
  ])("%s asistencias por %s con %s de descuento: %s - %s = %s", (validAttendances, rate, discount, gross, saved, net) => {
    expect(calculatePayrollAmounts({ validAttendances, rate, discount })).toEqual({
      accepted: true,
      gross,
      discount: saved,
      net,
    });
  });

  // C5 de la 11.5 (D56): un descuento que deja el neto en 0.00 tampoco es una planilla, porque el
  // pago exige un monto mayor que cero e igual al neto. 100.004 se guardaria como 100.00.
  it.each([100, "100.00", 100.004, 100.005, 100.01, 150])("un descuento de %s iguala o supera un bruto de 100.00", (discount) => {
    expect(calculatePayrollAmounts({ validAttendances: 2, rate: "50.00", discount })).toEqual({ accepted: false });
  });
});

describe("checkPayrollPayment", () => {
  it.each([
    ["90.00", 90, "90.00"],
    ["90.00", 90.004, "90.00"],
    ["30.10", 30.1, "30.10"],
    [new Prisma.Decimal("30.10"), "30.10", "30.10"],
  ])("sobre un neto de %s, un pago de %s se acepta como %s", (net, amount, saved) => {
    expect(checkPayrollPayment({ net, amount })).toEqual({ accepted: true, amount: saved });
  });

  it.each([
    ["30.10", 30.11],
    ["90.00", 90.009],
    ["90.00", 89.99],
    ["90.00", 90.005],
  ])("sobre un neto de %s, un pago de %s se rechaza", (net, amount) => {
    expect(checkPayrollPayment({ net, amount })).toEqual({ accepted: false });
  });
});
