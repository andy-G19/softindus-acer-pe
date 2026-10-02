import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { toNonNegativeNumber, toNumber } from "@/lib/numbers";

describe("toNumber", () => {
  it("convierte null y undefined en cero", () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });

  it("convierte Decimal de Prisma, number y texto numerico", () => {
    expect(toNumber(new Prisma.Decimal("1234.56"))).toBe(1234.56);
    expect(toNumber(12.5)).toBe(12.5);
    expect(toNumber("15.3")).toBe(15.3);
  });

  it("conserva los negativos", () => {
    expect(toNumber(new Prisma.Decimal("-7.25"))).toBe(-7.25);
    expect(toNumber(-3)).toBe(-3);
  });

  it("trata la cadena vacia como cero, igual que Number", () => {
    expect(toNumber("")).toBe(0);
  });

  it("no oculta los valores no numericos: devuelve NaN", () => {
    expect(toNumber("abc")).toBeNaN();
    expect(toNumber(Number.NaN)).toBeNaN();
  });
});

describe("toNonNegativeNumber", () => {
  it("convierte null y undefined en cero", () => {
    expect(toNonNegativeNumber(null)).toBe(0);
    expect(toNonNegativeNumber(undefined)).toBe(0);
  });

  it("convierte Decimal de Prisma, number y texto numerico", () => {
    expect(toNonNegativeNumber(new Prisma.Decimal("1234.56"))).toBe(1234.56);
    expect(toNonNegativeNumber(12.5)).toBe(12.5);
    expect(toNonNegativeNumber("15.3")).toBe(15.3);
  });

  it("trata los negativos como cero", () => {
    expect(toNonNegativeNumber(new Prisma.Decimal("-7.25"))).toBe(0);
    expect(toNonNegativeNumber(-3)).toBe(0);
  });

  it("trata los valores no numericos o infinitos como cero", () => {
    expect(toNonNegativeNumber("abc")).toBe(0);
    expect(toNonNegativeNumber(Number.NaN)).toBe(0);
    expect(toNonNegativeNumber(Number.POSITIVE_INFINITY)).toBe(0);
    expect(toNonNegativeNumber(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});
