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
