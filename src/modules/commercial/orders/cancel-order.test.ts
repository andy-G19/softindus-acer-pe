import { describe, expect, it, vi } from "vitest";

import { cancelOrderAction } from "@/modules/commercial/orders/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion de cancelar pedido (C2 de la 11.3b), escrita antes de tocar la accion: alta y
// edicion de pedidos tienen la suya en actions.test.ts (10.4c), cancelar no tenia ninguna.
//
// Va en su propio archivo porque cancelar escribe con el cliente global, fuera de una
// transaccion: el doble lo permite aqui (writesOutsideTransaction) sin cambiar las condiciones
// de las caracterizaciones de alta y edicion. Cada caso fija la autorizacion, la lectura del
// pedido con sus proformas, comprobantes y ordenes de trabajo, la escritura (y si va fuera de la
// transaccion), la bitacora, las revalidaciones y la redireccion.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock({
    transactions: true,
    recordTransactionEnd: true,
    writesOutsideTransaction: true,
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

const PEDIDO = "PED00000004";

type ActionCase = {
  name: string;
  id?: string;
  data?: DataOverrides;
  role?: "ADMIN" | "SELLER" | "WORKSHOP_MASTER";
};

/** Pedido registrado, sin proformas, comprobantes ni ordenes de trabajo. */
function orderRow(changes: Record<string, unknown> = {}) {
  return {
    id_pedido: PEDIDO,
    id_cliente: "CLI00000002",
    estado: "registrado",
    proforma: [],
    comprobante_venta: [],
    detalle_pedido: [{ id_detalle_pedido: "DPE00000001", id_producto: "PRO00000001", orden_trabajo: [] }],
    ...changes,
  };
}

async function runAction(actionCase: ActionCase) {
  const formData = new FormData();

  formData.append("id_pedido", actionCase.id ?? PEDIDO);

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        await cancelOrderAction(formData);

        return "termino sin redirigir";
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { "pedido.findUnique": orderRow(), ...actionCase.data },
    { role: actionCase.role ?? "SELLER" },
  );

  return { calls, outcome: result };
}

const cases: ActionCase[] = [
  { name: "registrado sin nada asociado: lo cancela" },
  { name: "aprobado: lo cancela", data: { "pedido.findUnique": orderRow({ estado: "aprobado" }) } },
  { name: "el id con espacios se recorta", id: ` ${PEDIDO} ` },
  { name: "sin id: vuelve al listado", id: "" },
  { name: "no existe: vuelve al listado", data: { "pedido.findUnique": null } },
  { name: "ya cancelado: vuelve al listado", data: { "pedido.findUnique": orderRow({ estado: "cancelado" }) } },
  { name: "anulado: vuelve al listado", data: { "pedido.findUnique": orderRow({ estado: "anulado" }) } },
  {
    name: "con una proforma: vuelve al listado sin decir por que",
    data: { "pedido.findUnique": orderRow({ proforma: [{ id_proforma: "PRF00000003" }] }) },
  },
  {
    name: "con un comprobante: vuelve al listado sin decir por que",
    data: { "pedido.findUnique": orderRow({ comprobante_venta: [{ id_comprobante: "CMP00000001" }] }) },
  },
  {
    name: "con una orden de trabajo: vuelve al listado sin decir por que",
    data: {
      "pedido.findUnique": orderRow({
        detalle_pedido: [
          { id_detalle_pedido: "DPE00000001", id_producto: "PRO00000001", orden_trabajo: [{ id_orden_trabajo: "OTR00000002" }] },
        ],
      }),
    },
  },
  { name: "sin permiso: el maestro de taller", role: "WORKSHOP_MASTER" },
];

describe("cancelOrderAction", () => {
  for (const actionCase of cases) {
    it(actionCase.name, async () => {
      const { calls, outcome } = await runAction(actionCase);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});
