import { describe, expect, it } from "vitest";

import { parseStringParam } from "@/lib/search-params";

describe("parseStringParam", () => {
  it("recorta espacios en blanco", () => {
    expect(parseStringParam({ q: "  acero  " }, "q")).toBe("acero");
  });

  it("devuelve string vacio si el parametro no existe", () => {
    expect(parseStringParam({}, "q")).toBe("");
  });

  it("toma el primer valor si el parametro llega como arreglo", () => {
    expect(parseStringParam({ q: ["uno", "dos"] }, "q")).toBe("uno");
  });

  it("protege contra strings demasiado largos (limite defensivo)", () => {
    const longValue = "a".repeat(500);
    const result = parseStringParam({ q: longValue }, "q");

    expect(result.length).toBeLessThanOrEqual(200);
  });
});
