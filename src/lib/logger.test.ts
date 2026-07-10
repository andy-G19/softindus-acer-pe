import { afterEach, describe, expect, it, vi } from "vitest";

import { logger, sanitizeMeta } from "@/lib/logger";

describe("sanitizeMeta", () => {
  it("redacta campos sensibles conocidos", () => {
    const result = sanitizeMeta({
      password: "supersecreta",
      clave_hash: "$2b$10$abc",
      token: "abc.def.ghi",
      AUTH_SECRET: "topsecret",
      DATABASE_URL: "postgresql://user:pass@host/db",
      authorization: "Bearer xyz",
      cookie: "session=abc",
    });

    expect(result?.password).toBe("[REDACTED]");
    expect(result?.clave_hash).toBe("[REDACTED]");
    expect(result?.token).toBe("[REDACTED]");
    expect(result?.AUTH_SECRET).toBe("[REDACTED]");
    expect(result?.DATABASE_URL).toBe("[REDACTED]");
    expect(result?.authorization).toBe("[REDACTED]");
    expect(result?.cookie).toBe("[REDACTED]");
  });

  it("no expone valores sensibles ni siquiera anidados dentro de objetos", () => {
    const result = sanitizeMeta({
      user: {
        email: "admin@acerosperu.com",
        password: "supersecreta",
      },
    });

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("supersecreta");
    expect(serialized).toContain("admin@acerosperu.com");
  });

  it("conserva campos no sensibles sin modificarlos", () => {
    const result = sanitizeMeta({ userId: "USU00000001", role: "ADMIN" });

    expect(result).toEqual({ userId: "USU00000001", role: "ADMIN" });
  });

  it("serializa instancias de Error sin romper", () => {
    const result = sanitizeMeta({ error: new Error("Fallo controlado") });
    const serializedError = result?.error as Record<string, unknown>;

    expect(serializedError.name).toBe("Error");
    expect(serializedError.message).toBe("Fallo controlado");
  });

  it("devuelve undefined cuando no hay metadata", () => {
    expect(sanitizeMeta(undefined)).toBeUndefined();
  });
});

describe("logger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("nunca imprime password/clave_hash/token/AUTH_SECRET/DATABASE_URL en texto plano", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.info("Intento de login", {
      password: "supersecreta",
      clave_hash: "$2b$10$abc",
      token: "abc.def.ghi",
      AUTH_SECRET: "topsecret",
      DATABASE_URL: "postgresql://user:pass@host/db",
    });

    const output = infoSpy.mock.calls.flat().map(String).join(" ");

    expect(output).not.toContain("supersecreta");
    expect(output).not.toContain("$2b$10$abc");
    expect(output).not.toContain("abc.def.ghi");
    expect(output).not.toContain("topsecret");
    expect(output).not.toContain("postgresql://user:pass@host/db");
  });

  it("no emite logs de debug en produccion", () => {
    vi.stubEnv("NODE_ENV", "production");
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

    logger.debug("Este mensaje no deberia imprimirse en produccion.");

    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("si emite logs de debug fuera de produccion", () => {
    vi.stubEnv("NODE_ENV", "development");
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);

    logger.debug("Mensaje de debug en desarrollo.");

    expect(debugSpy).toHaveBeenCalledTimes(1);
  });
});
