import { beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives";
import { formatCorrelativeId } from "@/lib/correlatives-format";
import { getTestDatabase } from "@/testing/test-database";

// Correlativos contra Postgres real (PGlite): el SELECT ... FOR UPDATE, el
// UPDATE del contador y el rollback los ejecuta la base, no un doble. La
// espera entre dos transacciones simultaneas no se puede probar aqui (ver
// test-database.ts).

let prisma: PrismaClient;

beforeAll(async () => {
  ({ prisma } = await getTestDatabase());
});

async function lastNumber(codigoEntidad: string) {
  const row = await prisma.correlativo_sistema.findUniqueOrThrow({
    where: { codigo_entidad: codigoEntidad },
    select: { ultimo_numero: true },
  });
  return row.ultimo_numero;
}

describe("correlativos en Postgres", () => {
  it("las migraciones dejan configurado el correlativo de clientes", async () => {
    const row = await prisma.correlativo_sistema.findUniqueOrThrow({
      where: { codigo_entidad: "cliente" },
      select: { prefijo: true, ultimo_numero: true },
    });

    expect(row).toEqual({ prefijo: "CLI", ultimo_numero: 0 });
  });

  it("cada transaccion reserva el numero siguiente y lo guarda", async () => {
    const before = await lastNumber("cliente");

    const first = await prisma.$transaction((tx) =>
      getNextCorrelativeId(tx, { codigoEntidad: "cliente", prefijo: "CLI" }),
    );
    const second = await prisma.$transaction((tx) =>
      getNextCorrelativeId(tx, { codigoEntidad: "cliente", prefijo: "CLI" }),
    );

    expect([first, second]).toEqual([
      formatCorrelativeId("CLI", before + 1),
      formatCorrelativeId("CLI", before + 2),
    ]);
    expect(await lastNumber("cliente")).toBe(before + 2);
  });

  it("un bloque reserva numeros contiguos y avanza el contador en la cantidad pedida", async () => {
    const before = await lastNumber("producto");

    const ids = await prisma.$transaction((tx) =>
      getNextCorrelativeIds(tx, {
        codigoEntidad: "producto",
        prefijo: "PRO",
        cantidad: 3,
      }),
    );

    expect(ids).toEqual([1, 2, 3].map((n) => formatCorrelativeId("PRO", before + n)));
    expect(await lastNumber("producto")).toBe(before + 3);
  });

  it("si la transaccion falla, el numero reservado vuelve a estar libre", async () => {
    const before = await lastNumber("pedido");

    await expect(
      prisma.$transaction(async (tx) => {
        await getNextCorrelativeId(tx, { codigoEntidad: "pedido", prefijo: "PED" });
        throw new Error("falla despues de reservar");
      }),
    ).rejects.toThrow("falla despues de reservar");

    expect(await lastNumber("pedido")).toBe(before);
    const next = await prisma.$transaction((tx) =>
      getNextCorrelativeId(tx, { codigoEntidad: "pedido", prefijo: "PED" }),
    );
    expect(next).toBe(formatCorrelativeId("PED", before + 1));
  });

  it("un prefijo que no coincide se rechaza sin tocar el contador", async () => {
    const before = await lastNumber("cliente");

    await expect(
      prisma.$transaction((tx) =>
        getNextCorrelativeId(tx, { codigoEntidad: "cliente", prefijo: "XXX" }),
      ),
    ).rejects.toThrow('El prefijo solicitado ("XXX") no coincide');

    expect(await lastNumber("cliente")).toBe(before);
  });
});

describe("base de pruebas de integracion", () => {
  it("@/lib/db entrega el cliente de la base en memoria", async () => {
    const { prisma: appPrisma } = await import("@/lib/db");

    expect(appPrisma).toBe(prisma);
  });
});
