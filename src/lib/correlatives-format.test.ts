import { describe, expect, it } from "vitest";

import { formatCorrelativeId } from "@/lib/correlatives-format";

describe("formatCorrelativeId", () => {
  it("combina el prefijo con el numero relleno a 8 digitos", () => {
    expect(formatCorrelativeId("CLI", 1)).toBe("CLI00000001");
    expect(formatCorrelativeId("PED", 42)).toBe("PED00000042");
  });

  it("no trunca cuando el numero ya tiene 8 digitos", () => {
    expect(formatCorrelativeId("MVI", 12345678)).toBe("MVI12345678");
  });

  it("respeta el prefijo tal cual, sin normalizarlo", () => {
    expect(formatCorrelativeId("bit", 5)).toBe("bit00000005");
  });
});
