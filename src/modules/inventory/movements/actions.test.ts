import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createInventoryOutputAction } from "@/modules/inventory/movements/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
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
// Hoy la orden asociada solo se comprueba que exista: los casos de orden
// anulada, finalizada o con materiales cerrados terminan en una salida
// registrada. Sus datos ya traen el estado y el cierre de la orden para que
// el fix de H9 cambie su resultado a proposito.

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

function defineCases(actionCases: ActionCase[]) {
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
    name: "la orden no existe: error en el campo de la orden, sin transaccion",
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
    name: "orden anulada: hoy se registra la salida",
    form: form({ id_orden_trabajo: OT }),
    data: {
      "orden_trabajo.findUnique": workOrderRow({ estado: "anulada" }),
      $queryRaw: lockedRows(materialRow()),
    },
  },
  {
    name: "orden finalizada: hoy se registra la salida",
    form: form({ id_orden_trabajo: OT }),
    data: {
      "orden_trabajo.findUnique": workOrderRow({ estado: "finalizada" }),
      $queryRaw: lockedRows(materialRow()),
    },
  },
  {
    name: "orden con materiales cerrados: hoy se registra la salida",
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
