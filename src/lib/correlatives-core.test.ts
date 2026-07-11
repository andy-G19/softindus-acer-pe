import { describe, expect, it, vi } from "vitest";

import type { CorrelativeTransactionClient } from "@/lib/correlatives-core";
import { getNextCorrelativeId, getNextCorrelativeIds } from "@/lib/correlatives-core";

// Estas pruebas cubren la logica pura de formateo/orquestacion con un
// cliente transaccional simulado (mock de $queryRaw/$executeRaw): no abren
// ninguna conexion a PostgreSQL. El comportamiento real del bloqueo
// "FOR UPDATE" bajo concurrencia (y del advisory lock del bootstrap) solo
// puede validarse con una prueba de integracion contra una base desechable,
// pendiente para una fase posterior.
function createMockTx(
  row: { codigo_entidad: string; prefijo: string; ultimo_numero: number } | undefined,
): CorrelativeTransactionClient {
  return {
    $queryRaw: vi.fn().mockResolvedValue(row ? [row] : []),
    $executeRaw: vi.fn().mockResolvedValue(1),
  } as unknown as CorrelativeTransactionClient;
}

describe("getNextCorrelativeIds", () => {
  it("devuelve un arreglo vacio si la cantidad solicitada es menor a 1", async () => {
    const tx = createMockTx({ codigo_entidad: "cliente", prefijo: "CLI", ultimo_numero: 0 });

    const ids = await getNextCorrelativeIds(tx, {
      codigoEntidad: "cliente",
      prefijo: "CLI",
      cantidad: 0,
    });

    expect(ids).toEqual([]);
  });

  it("genera ids consecutivos con el formato prefijo + numero de 8 digitos", async () => {
    const tx = createMockTx({ codigo_entidad: "cliente", prefijo: "CLI", ultimo_numero: 5 });

    const ids = await getNextCorrelativeIds(tx, {
      codigoEntidad: "cliente",
      prefijo: "CLI",
      cantidad: 3,
    });

    expect(ids).toEqual(["CLI00000006", "CLI00000007", "CLI00000008"]);
  });

  it("lanza un error si el correlativo no esta configurado", async () => {
    const tx = createMockTx(undefined);

    await expect(
      getNextCorrelativeIds(tx, {
        codigoEntidad: "inexistente",
        prefijo: "XXX",
        cantidad: 1,
      }),
    ).rejects.toThrow(/No existe un correlativo configurado/);
  });

  it("lanza un error si el prefijo solicitado no coincide con el configurado", async () => {
    const tx = createMockTx({ codigo_entidad: "cliente", prefijo: "CLI", ultimo_numero: 0 });

    await expect(
      getNextCorrelativeIds(tx, {
        codigoEntidad: "cliente",
        prefijo: "OTRO",
        cantidad: 1,
      }),
    ).rejects.toThrow(/no coincide con el prefijo configurado/);
  });
});

describe("getNextCorrelativeId", () => {
  it("devuelve un unico id siguiente", async () => {
    const tx = createMockTx({ codigo_entidad: "usuario", prefijo: "USU", ultimo_numero: 0 });

    const id = await getNextCorrelativeId(tx, {
      codigoEntidad: "usuario",
      prefijo: "USU",
    });

    expect(id).toBe("USU00000001");
  });
});
