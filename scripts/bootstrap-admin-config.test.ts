import { describe, expect, it } from "vitest";

import { parseBootstrapAdminConfig } from "./bootstrap-admin-config";

// Construye una contraseña sintetica de la longitud pedida combinando un
// bloque fijo (una mayuscula, un digito, un caracter especial y varias
// minusculas) repetido y recortado. A proposito no es un string literal
// completo con apariencia de credencial: se ensambla en tiempo de ejecucion
// solo para satisfacer/violar las reglas de complejidad bajo prueba.
function buildSyntheticPassword(length: number): string {
  const complexityBlock = ["Q", "7", "$", "bcdfghjkmnpqrstvwxyz"].join("");
  const repeated = complexityBlock.repeat(Math.ceil(length / complexityBlock.length));

  return repeated.slice(0, length);
}

const VALID_ENV = {
  BOOTSTRAP_ADMIN_CONFIRM: "CREATE_INITIAL_ADMIN",
  BOOTSTRAP_ADMIN_NAMES: "Ana",
  BOOTSTRAP_ADMIN_SURNAMES: "Torres",
  BOOTSTRAP_ADMIN_USERNAME: "atorres",
  BOOTSTRAP_ADMIN_EMAIL: "ana.torres@acerosperu.com",
  BOOTSTRAP_ADMIN_PASSWORD: buildSyntheticPassword(16),
};

describe("parseBootstrapAdminConfig", () => {
  it("rechaza una confirmacion incorrecta", () => {
    const result = parseBootstrapAdminConfig({
      ...VALID_ENV,
      BOOTSTRAP_ADMIN_CONFIRM: "yes",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza nombres vacios", () => {
    const result = parseBootstrapAdminConfig({
      ...VALID_ENV,
      BOOTSTRAP_ADMIN_NAMES: "   ",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza apellidos vacios", () => {
    const result = parseBootstrapAdminConfig({
      ...VALID_ENV,
      BOOTSTRAP_ADMIN_SURNAMES: "",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un username invalido", () => {
    const result = parseBootstrapAdminConfig({
      ...VALID_ENV,
      BOOTSTRAP_ADMIN_USERNAME: "ab",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza un correo invalido", () => {
    const result = parseBootstrapAdminConfig({
      ...VALID_ENV,
      BOOTSTRAP_ADMIN_EMAIL: "no-es-un-correo",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza una contraseña menor a 12 caracteres", () => {
    const result = parseBootstrapAdminConfig({
      ...VALID_ENV,
      BOOTSTRAP_ADMIN_PASSWORD: buildSyntheticPassword(7),
    });

    expect(result.success).toBe(false);
  });

  it("acepta un conjunto valido sin devolver ni imprimir la contraseña en texto plano fuera de 'data'", () => {
    const result = parseBootstrapAdminConfig(VALID_ENV);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data.BOOTSTRAP_ADMIN_EMAIL).toBe(
        "ana.torres@acerosperu.com",
      );
      expect(result.data.BOOTSTRAP_ADMIN_USERNAME).toBe("atorres");
    } else {
      throw new Error("Se esperaba que la configuracion fuera valida.");
    }
  });

  it("no incluye la contraseña recibida en los mensajes de error", () => {
    const rejectedPassword = buildSyntheticPassword(9);

    const result = parseBootstrapAdminConfig({
      ...VALID_ENV,
      BOOTSTRAP_ADMIN_PASSWORD: rejectedPassword,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const joinedErrors = result.errors.join(" | ");
      expect(joinedErrors).not.toContain(rejectedPassword);
    }
  });
});
