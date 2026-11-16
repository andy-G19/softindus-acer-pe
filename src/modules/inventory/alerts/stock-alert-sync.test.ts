import { beforeEach, describe, expect, it, vi } from "vitest";

import { syncStockAlert } from "@/modules/inventory/alerts/stock-alert-sync";

// C3 de la 11.6a (D64, hallazgo 7 de la 10.3a): la alerta se buscaba activa y despues se
// actualizaba por su id. Si alguien la atendia entre esas dos sentencias, la entrega a una orden
// (o una salida de inventario) le reescribia el mensaje y el stock a una alerta ya atendida, y no
// abria otra aunque el material siguiera critico. Ahora la escritura es un compare-and-set: solo
// cambia la alerta que sigue activa, y si no queda ninguna, abre otra.
//
// El doble del cliente reproduce esa carrera: la lectura ve la alerta activa, pero cuando llega la
// escritura ya fue atendida y una actualizacion condicionada al estado no la encuentra.

vi.mock("@/lib/correlatives-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
  getNextCorrelativeIds: async () => ["ALE00000009"],
}));

type Call = { method: string; args: Record<string, unknown> };

let calls: Call[];

/** Un cliente cuya alerta activa se atendio despues de leerla (o no, con stillActive). */
function txWhereAlertWasAttended({ stillActive }: { stillActive: boolean }) {
  const record = (method: string) => async (args: Record<string, unknown>) => {
    calls.push({ method, args });

    if (method === "findFirst") {
      return { id_alerta: "ALE00000003" };
    }

    if (method === "updateMany") {
      const where = args.where as Record<string, unknown>;

      return { count: where.estado_alerta === "activa" && !stillActive ? 0 : 1 };
    }

    return {};
  };

  return {
    alerta_stock: {
      findFirst: record("findFirst"),
      update: record("update"),
      updateMany: record("updateMany"),
      create: record("create"),
    },
  } as unknown as Parameters<typeof syncStockAlert>[0];
}

const params = {
  idMaterial: "MAT00000001",
  materialName: "Plancha LAC",
  stockMinimo: 30,
  idOrdenTrabajo: "OTR00000007",
  idUsuario: "USU00000001",
};

const written = (method: string) => calls.filter((call) => call.method === method);

beforeEach(() => {
  calls = [];
});

describe("C3 de la 11.6a: la alerta de stock con compare-and-set", () => {
  it("stock critico y la alerta se atendio despues de leerla: no la reescribe y abre otra", async () => {
    await syncStockAlert(txWhereAlertWasAttended({ stillActive: false }), { ...params, stockResultante: 21.25 });

    expect(written("update")).toEqual([]);
    expect(written("updateMany").map((call) => call.args.where)).toEqual([
      { id_material: "MAT00000001", estado_alerta: "activa" },
    ]);
    expect(written("create").map((call) => (call.args.data as Record<string, unknown>).estado_alerta)).toEqual([
      "activa",
    ]);
  });

  it("stock critico y la alerta sigue activa: la actualiza y no abre otra", async () => {
    await syncStockAlert(txWhereAlertWasAttended({ stillActive: true }), { ...params, stockResultante: 21.25 });

    expect(written("updateMany").map((call) => (call.args.data as Record<string, unknown>).stock_detectado)).toEqual([
      21.25,
    ]);
    expect(written("create")).toEqual([]);
  });

  it("stock recuperado: atiende solo la alerta que sigue activa", async () => {
    await syncStockAlert(txWhereAlertWasAttended({ stillActive: false }), { ...params, stockResultante: 51.25 });

    expect(written("update")).toEqual([]);
    expect(written("updateMany").map((call) => call.args.where)).toEqual([
      { id_material: "MAT00000001", estado_alerta: "activa" },
    ]);
    expect(written("create")).toEqual([]);
  });
});
