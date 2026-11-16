import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { quantityHundredths, roundMaterialQuantity } from "@/lib/material-quantities";

// Cantidades de material (C1 de la 11.6a, D62): en centesimos, con el redondeo de las columnas.

describe("roundMaterialQuantity", () => {
  it.each([
    [0.005, "0.01"],
    [0.004, "0.00"],
    [10.004, "10.00"],
    [2.675, "2.68"],
    // (1.005).toFixed(2) da 1.00; la columna numeric guarda 1.01.
    [1.005, "1.01"],
    ["5.004", "5.00"],
    [new Prisma.Decimal("19.99"), "19.99"],
  ])("%s se guarda como %s", (value, saved) => {
    expect(roundMaterialQuantity(value)).toBe(saved);
  });
});

describe("quantityHundredths", () => {
  it.each([
    [new Prisma.Decimal("10.00"), 1000n],
    [10.004, 1000n],
    [0.005, 1n],
    [0, 0n],
  ])("%s son %s centesimos", (value, hundredths) => {
    expect(quantityHundredths(value)).toBe(hundredths);
  });
});
