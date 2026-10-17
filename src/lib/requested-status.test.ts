import { describe, expect, it } from "vitest";

import { parseRequestedStatus } from "@/lib/requested-status";

describe("parseRequestedStatus", () => {
  it("lee el estado pedido", () => {
    expect(parseRequestedStatus("true")).toBe(true);
    expect(parseRequestedStatus("false")).toBe(false);
  });

  it("cualquier otro valor no es un estado", () => {
    for (const value of [null, "", "on", "1", "0", "True", " true", "si"]) {
      expect(parseRequestedStatus(value)).toBeNull();
    }
    expect(parseRequestedStatus(new File(["true"], "estado.txt"))).toBeNull();
  });
});
