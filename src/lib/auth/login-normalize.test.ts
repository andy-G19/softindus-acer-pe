import { describe, expect, it } from "vitest";

import { hashLoginValue, normalizeLoginEmail } from "@/lib/auth/login-normalize";

describe("normalizeLoginEmail", () => {
  it("recorta espacios y convierte a minusculas", () => {
    expect(normalizeLoginEmail("  Admin@AcerosPeru.com  ")).toBe(
      "admin@acerosperu.com",
    );
  });

  it("no cambia un correo ya normalizado", () => {
    expect(normalizeLoginEmail("vendedor@acerosperu.com")).toBe(
      "vendedor@acerosperu.com",
    );
  });
});

describe("hashLoginValue", () => {
  it("produce un hash estable (mismo valor de entrada -> mismo hash)", () => {
    const hash1 = hashLoginValue("192.168.1.1");
    const hash2 = hashLoginValue("192.168.1.1");

    expect(hash1).toBe(hash2);
  });

  it("el hash nunca es igual al valor original", () => {
    const value = "192.168.1.1";

    expect(hashLoginValue(value)).not.toBe(value);
  });

  it("produce un hash hexadecimal de 64 caracteres (sha256)", () => {
    const hash = hashLoginValue("cualquier-valor");

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("entradas distintas producen hashes distintos", () => {
    expect(hashLoginValue("valor-a")).not.toBe(hashLoginValue("valor-b"));
  });
});
