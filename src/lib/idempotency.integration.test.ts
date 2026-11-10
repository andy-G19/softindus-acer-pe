import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  claimOperation,
  completeOperation,
  IdempotencyConflictError,
} from "@/lib/idempotency";
import { getTestDatabase } from "@/testing/test-database";

// Claves de idempotencia contra Postgres real (PGlite). Lo que no se puede
// probar aqui: dos envios simultaneos con la misma clave. En Postgres el
// segundo INSERT espera a que la transaccion del primero termine; si confirma,
// el segundo ve la clave como repetida, y si se deshace, la reclama como
// nueva. PGlite atiende una sola transaccion a la vez (ver test-database.ts).

const USUARIO = "USU00000001";
const OTRO_USUARIO = "USU00000002";
const TIPO = "crear_compra";

let prisma: PrismaClient;

beforeAll(async () => {
  ({ prisma } = await getTestDatabase());

  await prisma.rol.create({ data: { id_rol: "ROL00000001", nombre_rol: "ADMIN" } });
  await prisma.usuario.createMany({
    data: [USUARIO, OTRO_USUARIO].map((id_usuario, index) => ({
      id_usuario,
      id_rol: "ROL00000001",
      nombres: `Nombre ${index + 1}`,
      apellidos: "Prueba",
      usuario: `usuario${index + 1}`,
      clave_hash: "sin-uso",
    })),
  });
});

function storedOperation(clave: string) {
  return prisma.operacion_idempotente.findUnique({
    where: { clave },
    select: { tipo_operacion: true, id_usuario: true, id_registro_resultado: true },
  });
}

describe("claimOperation y completeOperation", () => {
  it("una clave nueva se reclama y guarda el registro que produjo la operacion", async () => {
    const clave = randomUUID();

    const result = await prisma.$transaction(async (tx) => {
      const claim = await claimOperation(tx, { clave, tipo: TIPO, userId: USUARIO });
      await completeOperation(tx, { clave, idRegistro: "COM00000001" });
      return claim;
    });

    expect(result).toEqual({ estado: "nueva" });
    expect(await storedOperation(clave)).toEqual({
      tipo_operacion: TIPO,
      id_usuario: USUARIO,
      id_registro_resultado: "COM00000001",
    });
  });

  it("un reenvio con la misma clave devuelve el registro guardado y la transaccion sigue viva", async () => {
    const clave = randomUUID();
    await prisma.$transaction(async (tx) => {
      await claimOperation(tx, { clave, tipo: TIPO, userId: USUARIO });
      await completeOperation(tx, { clave, idRegistro: "COM00000002" });
    });

    const result = await prisma.$transaction(async (tx) => {
      const claim = await claimOperation(tx, { clave, tipo: TIPO, userId: USUARIO });
      // Si el reclamo hubiera abortado la transaccion, esta lectura fallaria.
      const count = await tx.operacion_idempotente.count({ where: { clave } });
      return { claim, count };
    });

    expect(result).toEqual({
      claim: { estado: "repetida", idRegistro: "COM00000002" },
      count: 1,
    });
  });

  it("si la transaccion falla, la clave queda libre para el siguiente envio", async () => {
    const clave = randomUUID();

    await expect(
      prisma.$transaction(async (tx) => {
        await claimOperation(tx, { clave, tipo: TIPO, userId: USUARIO });
        throw new Error("falla despues de reclamar");
      }),
    ).rejects.toThrow("falla despues de reclamar");

    expect(await storedOperation(clave)).toBeNull();
    const result = await prisma.$transaction((tx) =>
      claimOperation(tx, { clave, tipo: TIPO, userId: USUARIO }),
    );
    expect(result).toEqual({ estado: "nueva" });
  });

  it("la misma clave con otro usuario es un conflicto y no entrega el resultado ajeno", async () => {
    const clave = randomUUID();
    await prisma.$transaction(async (tx) => {
      await claimOperation(tx, { clave, tipo: TIPO, userId: USUARIO });
      await completeOperation(tx, { clave, idRegistro: "COM00000003" });
    });

    await expect(
      prisma.$transaction((tx) =>
        claimOperation(tx, { clave, tipo: TIPO, userId: OTRO_USUARIO }),
      ),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect((await storedOperation(clave))?.id_usuario).toBe(USUARIO);
  });

  it("la misma clave en otra operacion es un conflicto", async () => {
    const clave = randomUUID();
    await prisma.$transaction((tx) =>
      claimOperation(tx, { clave, tipo: TIPO, userId: USUARIO }),
    );

    await expect(
      prisma.$transaction((tx) =>
        claimOperation(tx, { clave, tipo: "registrar_pago", userId: USUARIO }),
      ),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("completar una clave que no se reclamo es un error", async () => {
    await expect(
      prisma.$transaction((tx) =>
        completeOperation(tx, { clave: randomUUID(), idRegistro: "COM00000004" }),
      ),
    ).rejects.toThrow("no fue reclamada");
  });

  it("una clave que no es un UUID se rechaza antes de escribir", async () => {
    const before = await prisma.operacion_idempotente.count();

    await expect(
      prisma.$transaction((tx) =>
        claimOperation(tx, { clave: "no-es-uuid", tipo: TIPO, userId: USUARIO }),
      ),
    ).rejects.toThrow("no es valida");
    expect(await prisma.operacion_idempotente.count()).toBe(before);
  });
});
