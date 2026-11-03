import { describe, expect, it } from "vitest";

import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
} from "@/schemas/users/user.schema";

const validUser = {
  nombres: "Ana",
  apellidos: "Torres",
  usuario: "atorres",
  correo: "ana.torres@acerosperu.com",
  rol: "SELLER",
  password: "Segura#123",
  confirmPassword: "Segura#123",
};

describe("createUserSchema", () => {
  it("acepta datos válidos", () => {
    const result = createUserSchema.safeParse(validUser);

    expect(result.success).toBe(true);
  });

  it("normaliza el correo a minusculas y sin espacios", () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      correo: "  Ana.Torres@AcerosPeru.com  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.correo).toBe("ana.torres@acerosperu.com");
    }
  });

  it("rechaza un correo invalido", () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      correo: "no-es-un-correo",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza una contraseña debil (sin mayuscula/numero/especial)", () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      password: "minuscula",
      confirmPassword: "minuscula",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza una contraseña corta aunque cumpla los demas requisitos", () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      password: "Ab1#",
      confirmPassword: "Ab1#",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza cuando la confirmacion no coincide", () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      password: "Segura#123",
      confirmPassword: "OtraClave#123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const confirmError = result.error.issues.find((issue) =>
        issue.path.includes("confirmPassword"),
      );
      expect(confirmError).toBeDefined();
    }
  });

  it("rechaza un rol fuera de ADMIN/SELLER/WORKSHOP_MASTER", () => {
    const result = createUserSchema.safeParse({
      ...validUser,
      rol: "SUPERUSER",
    });

    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("acepta datos validos incluyendo estado", () => {
    const result = updateUserSchema.safeParse({
      id_usuario: "USU00000002",
      nombres: "Ana",
      apellidos: "Torres",
      usuario: "atorres",
      correo: "ana.torres@acerosperu.com",
      rol: "WORKSHOP_MASTER",
      estado: "activo",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza un estado que no sea activo/inactivo", () => {
    const result = updateUserSchema.safeParse({
      id_usuario: "USU00000002",
      nombres: "Ana",
      apellidos: "Torres",
      usuario: "atorres",
      correo: "ana.torres@acerosperu.com",
      rol: "SELLER",
      estado: "bloqueado",
    });

    expect(result.success).toBe(false);
  });
});

describe("resetUserPasswordSchema", () => {
  it("acepta una contraseña valida", () => {
    const result = resetUserPasswordSchema.safeParse({
      id_usuario: "USU00000002",
      password: "NuevaClave#1",
      confirmPassword: "NuevaClave#1",
    });

    expect(result.success).toBe(true);
  });

  it("rechaza una contraseña debil", () => {
    const result = resetUserPasswordSchema.safeParse({
      id_usuario: "USU00000002",
      password: "12345678",
      confirmPassword: "12345678",
    });

    expect(result.success).toBe(false);
  });

  it("rechaza cuando la confirmacion no coincide", () => {
    const result = resetUserPasswordSchema.safeParse({
      id_usuario: "USU00000002",
      password: "NuevaClave#1",
      confirmPassword: "OtraClave#1",
    });

    expect(result.success).toBe(false);
  });
});

// bcrypt solo usa los primeros 72 bytes de la contraseña: dos contraseñas que
// comparten ese principio servirian igual. El esquema rechaza las mas largas en
// el alta y el restablecer (B4 de la 10.7b, hallazgo 19); cada vocal con tilde
// o ñ ocupa 2 bytes en UTF-8.
describe("limite de 72 bytes de la contraseña", () => {
  const MAX_BYTES_MESSAGE =
    "La contraseña no debe superar los 72 caracteres; las tildes y la ñ cuentan doble.";
  const of72Bytes = `Aa1!${"x".repeat(68)}`;
  const of73Bytes = `Aa1!${"x".repeat(69)}`;
  // 40 caracteres y 80 bytes.
  const accented = `Aa1!${"á".repeat(36)}`;

  const passwordMessages = (result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
    (result.error?.issues ?? []).filter((issue) => issue.path[0] === "password").map((issue) => issue.message);

  it.each([
    ["el alta", (password: string) => createUserSchema.safeParse({ ...validUser, password, confirmPassword: password })],
    [
      "el restablecer",
      (password: string) => resetUserPasswordSchema.safeParse({ id_usuario: "USU00000002", password, confirmPassword: password }),
    ],
  ])("%s acepta 72 bytes y rechaza 73 con su mensaje", (_name, parse) => {
    expect(parse(of72Bytes).success).toBe(true);
    expect(passwordMessages(parse(of73Bytes))).toEqual([MAX_BYTES_MESSAGE]);
  });

  it("cuenta bytes, no caracteres: 40 caracteres con tildes se rechazan", () => {
    const result = createUserSchema.safeParse({ ...validUser, password: accented, confirmPassword: accented });

    expect(accented.length).toBe(40);
    expect(passwordMessages(result)).toEqual([MAX_BYTES_MESSAGE]);
  });
});
