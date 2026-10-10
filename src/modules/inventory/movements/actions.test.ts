import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createInventoryOutputAction } from "@/modules/inventory/movements/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isPrismaRead,
  type DataOverrides,
  type PrismaArgs,
} from "@/testing/page-characterization";

// Caracterizacion de la salida de inventario (grupo 1 de fixes), escrita antes
// de corregir H9.
//
// La accion se usa con useActionState: un rechazo de validacion no lanza,
// devuelve un estado con el error y los errores de campo. Cada caso ejecuta
// la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion,
// las lecturas, la transaccion con el bloqueo del material, sus escrituras y
// su final, el correlativo, la bitacora, las revalidaciones y el resultado:
// el estado devuelto, la redireccion o el error relanzado.
//
// Hasta el fix de H9 la orden asociada solo se comprobaba, fuera de la
// transaccion, que existiera, y las ordenes anuladas, finalizadas o con los
// materiales cerrados recibian la salida. Desde H9 la transaccion bloquea la
// orden y rechaza esos casos en el campo de la orden.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock({
    transactions: true,
    recordTransactionEnd: true,
  }),
);
vi.mock("@/lib/authz", async () =>
  (await import("@/testing/page-characterization")).authzModuleMock(),
);
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);
vi.mock("next/cache", async () => {
  const { recordEffect } = await import("@/testing/page-characterization");

  return {
    revalidatePath: (path: string) => recordEffect("revalidatePath", path),
  };
});
vi.mock("@/lib/audit", async () => {
  const { recordEffect } = await import("@/testing/page-characterization");

  return {
    registerAuditLog: async ({ tx, ...data }: Record<string, unknown>) => {
      recordEffect("registerAuditLog", { ...data, enTransaccion: tx !== undefined });
    },
  };
});
vi.mock("@/lib/correlatives-core", async (importOriginal) => {
  const { recordEffect } = await import("@/testing/page-characterization");
  const { formatCorrelativeId } = await import("@/lib/correlatives-format");

  return {
    ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
    getNextCorrelativeId: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string },
    ) => {
      recordEffect("getNextCorrelativeId", params);

      const next = (mocks.correlatives.get(params.prefijo) ?? 0) + 1;

      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
  };
});

expect.addSnapshotSerializer(decimalSnapshotSerializer);

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

type ActionCase = { name: string; form: Record<string, string>; data?: DataOverrides };

async function runAction(actionCase: ActionCase) {
  mocks.correlatives.clear();

  const formData = new FormData();

  for (const [key, value] of Object.entries(actionCase.form)) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(async () => {
    try {
      // El mismo estado inicial que usa el formulario con useActionState.
      return { estado: await createInventoryOutputAction({ error: "" }, formData) };
    } catch (error) {
      return (
        describeNavigationError(error) ??
        `error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, actionCase.data);

  return { calls, outcome: result };
}

// Los casos por nombre, para que las pruebas del fix los repitan sin copiarlos.
const cases: ActionCase[] = [];

function defineCases(actionCases: ActionCase[]) {
  cases.push(...actionCases);

  describe("createInventoryOutputAction", () => {
    for (const actionCase of actionCases) {
      it(actionCase.name, async () => {
        const { calls, outcome } = await runAction(actionCase);

        expectAuthorizesBeforePrisma(calls);
        expect(calls).toMatchSnapshot("llamadas");
        expect(outcome).toMatchSnapshot("resultado");
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const D = (value: string) => new Prisma.Decimal(value);

const MATERIAL = "MAT00000006";
const OT = "OTR00000007";

type Row = Record<string, unknown>;

function materialRow(changes: Row = {}) {
  return {
    id_material: MATERIAL,
    nombre_material: "Plancha LAC 2 mm",
    stock_actual: D("12.50"),
    stock_reservado: D("2.25"),
    estado: true,
    ...changes,
  };
}

// El bloqueo del material es SQL crudo: el caso responde segun la tabla.
function lockedRows(material: Row | null) {
  return (args: PrismaArgs) =>
    String(args?.sql).includes("FROM aceros.material") && material ? [material] : [];
}

function workOrderRow(changes: Row = {}) {
  return {
    id_orden_trabajo: OT,
    estado: "en_proceso",
    fecha_cierre_materiales: null,
    ...changes,
  };
}

const form = (changes: Record<string, string> = {}) => ({
  id_material: MATERIAL,
  id_orden_trabajo: "",
  cantidad: "3.75",
  motivo: "Corte de prueba",
  ...changes,
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases([
  {
    name: "datos invalidos: devuelve los errores de campo sin consultar",
    form: form({ id_material: " ", cantidad: "0", motivo: "ab" }),
  },
  {
    name: "la orden no existe: error en el campo de la orden y se revierte",
    form: form({ id_orden_trabajo: ` ${OT} ` }),
    data: { "orden_trabajo.findUnique": null },
  },
  {
    name: "el material no existe: error en el campo del material y se revierte",
    form: form(),
    data: { $queryRaw: lockedRows(null) },
  },
  {
    name: "material inactivo: error en el campo del material",
    form: form(),
    data: { $queryRaw: lockedRows(materialRow({ estado: false })) },
  },
  {
    name: "stock disponible insuficiente: descuenta lo reservado",
    form: form({ cantidad: "10.26" }),
    data: { $queryRaw: lockedRows(materialRow()) },
  },
  {
    name: "sin orden: descuenta el stock, registra el kardex y la bitacora con el material",
    form: form({ cantidad: "10.25" }),
    data: { $queryRaw: lockedRows(materialRow()) },
  },
  {
    name: "con orden en proceso: la asocia al movimiento y a la bitacora",
    form: form({ id_orden_trabajo: OT }),
    data: {
      "orden_trabajo.findUnique": workOrderRow(),
      $queryRaw: lockedRows(materialRow()),
    },
  },
  {
    name: "orden anulada: rechaza la salida en el campo de la orden",
    form: form({ id_orden_trabajo: OT }),
    data: {
      "orden_trabajo.findUnique": workOrderRow({ estado: "anulada" }),
      $queryRaw: lockedRows(materialRow()),
    },
  },
  {
    name: "orden finalizada: rechaza la salida en el campo de la orden",
    form: form({ id_orden_trabajo: OT }),
    data: {
      "orden_trabajo.findUnique": workOrderRow({ estado: "finalizada" }),
      $queryRaw: lockedRows(materialRow()),
    },
  },
  {
    name: "orden con materiales cerrados: rechaza la salida en el campo de la orden",
    form: form({ id_orden_trabajo: OT }),
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        fecha_cierre_materiales: new Date("2026-07-10T15:00:00.000Z"),
      }),
      $queryRaw: lockedRows(materialRow()),
    },
  },
  {
    name: "un error inesperado dentro de la transaccion se relanza",
    form: form(),
    data: {
      $queryRaw: lockedRows(materialRow()),
      "material.update": () => {
        throw new Error("Conexion interrumpida.");
      },
    },
  },
]);

// ---------------------------------------------------------------------------
// H9 (grupo 1 de fixes): la salida a una orden aplica la regla de la entrega
// ---------------------------------------------------------------------------

// La salida solo comprobaba, fuera de la transaccion, que la orden existiera:
// aceptaba ordenes anuladas, finalizadas o con los materiales cerrados, y una
// anulacion simultanea podia colarse. Ahora, si hay orden, la transaccion la
// bloquea antes de leerla y aplica la misma regla que la entrega desde la
// orden, con el error en el campo de la orden y sin escribir nada.
function findCase(name: string) {
  const actionCase = cases.find((item) => item.name === name);

  if (!actionCase) {
    throw new Error(`No existe el caso "${name}".`);
  }

  return actionCase;
}

describe("H9: la salida a una orden decide con la orden bloqueada", () => {
  const withWorkOrder = cases.filter((actionCase) => actionCase.form.id_orden_trabajo.trim() !== "");

  it("cubre los 5 casos con orden", () => {
    expect(withWorkOrder).toHaveLength(5);
  });

  for (const actionCase of withWorkOrder) {
    it(actionCase.name, async () => {
      const { calls } = await runAction(actionCase);

      expectRowLockedBefore(calls, { table: "orden_trabajo", id: OT, reads: isPrismaRead });
    });
  }
});

describe("H9: rechaza la salida a una orden que ya no admite material", () => {
  const rejected = [
    ["orden anulada: rechaza la salida en el campo de la orden", "No se puede entregar material a una orden anulada o finalizada."],
    ["orden finalizada: rechaza la salida en el campo de la orden", "No se puede entregar material a una orden anulada o finalizada."],
    ["orden con materiales cerrados: rechaza la salida en el campo de la orden", "Los materiales de esta orden ya fueron cerrados."],
  ];

  for (const [caseName, message] of rejected) {
    it(caseName, async () => {
      const { calls, outcome } = await runAction(findCase(caseName));
      const writes = calls.filter(
        (call) => "prisma" in call && /\.(create|update)$/.test(call.prisma),
      );

      expect(outcome).toEqual({
        estado: { error: message, fieldErrors: { id_orden_trabajo: [message] } },
      });
      expect(writes).toEqual([]);
    });
  }
});
