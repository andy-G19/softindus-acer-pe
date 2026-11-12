import { describe, expect, it, vi } from "vitest";

import { cancelOrderAction } from "@/modules/commercial/orders/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion de cancelar pedido (C2 de la 11.3b), escrita antes de tocar la accion: alta y
// edicion de pedidos tienen la suya en actions.test.ts (10.4c), cancelar no tenia ninguna. Desde
// C8 de la 11.3b la accion devuelve un RowStatusState: el rechazo queda en la confirmacion en
// lugar de un redirect sin explicacion.
//
// Va en su propio archivo porque cancelar escribe con el cliente global, fuera de una
// transaccion: el doble lo permite aqui (writesOutsideTransaction) sin cambiar las condiciones
// de las caracterizaciones de alta y edicion. Cada caso fija la autorizacion, la lectura del
// pedido con sus proformas, comprobantes y ordenes de trabajo, la escritura (y si va fuera de la
// transaccion), la bitacora, las revalidaciones y la redireccion.

vi.mock("server-only", () => ({}));
// Cada respuesta lleva un operationId aleatorio: se fija para que el snapshot sea estable.
vi.mock("@/lib/action-result", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/action-result")>()),
  newOperationId: () => "operacion-de-prueba",
}));
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
const LINKED = "No se puede modificar un pedido con proforma, comprobante u orden asociada.";

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
        // El mismo estado inicial que usa ConfirmActionButton (desde C8 de la 11.3b).
        return await cancelOrderAction({ status: "idle" }, formData);
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
  { name: "sin id: responde en la confirmacion", id: "" },
  { name: "no existe: lo dice en la confirmacion", data: { "pedido.findUnique": null } },
  { name: "ya cancelado: lo dice en la confirmacion", data: { "pedido.findUnique": orderRow({ estado: "cancelado" }) } },
  { name: "anulado: lo dice en la confirmacion", data: { "pedido.findUnique": orderRow({ estado: "anulado" }) } },
  {
    name: "con una proforma activa: dice por que no lo cancela",
    data: { "pedido.findUnique": orderRow({ proforma: [{ id_proforma: "PRF00000003", estado: "vigente" }] }) },
  },
  {
    name: "con un comprobante emitido: dice por que no lo cancela",
    data: { "pedido.findUnique": orderRow({ comprobante_venta: [{ id_comprobante: "CMP00000001", estado: "emitido" }] }) },
  },
  {
    name: "con una orden de trabajo: dice por que no lo cancela",
    data: {
      "pedido.findUnique": orderRow({
        detalle_pedido: [
          { id_detalle_pedido: "DPE00000001", id_producto: "PRO00000001", orden_trabajo: [{ id_orden_trabajo: "OTR00000002" }] },
        ],
      }),
    },
  },
  { name: "sin permiso: el maestro de taller", role: "WORKSHOP_MASTER" },
  { name: "el administrador lo cancela igual", role: "ADMIN" },
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

// ---------------------------------------------------------------------------
// C3 de la 11.3b (D30): una sola regla para cambiar un pedido
// ---------------------------------------------------------------------------

// Cancelar rechazaba con cualquier proforma o comprobante, tambien anulados, mientras el listado
// ofrecia el boton: un pedido cuya unica proforma se anulo no se podia cancelar nunca. Ahora solo
// bloquean una proforma activa (vigente, aceptada o pagada) y un comprobante emitido.
describe("C3 de la 11.3b: cancelar aplica la regla del pedido", () => {
  const CANCELLED = { status: "success", data: { estado: "cancelado" }, values: { id: PEDIDO } };

  it("con su proforma anulada: lo cancela", async () => {
    const { outcome } = await runAction({
      name: "C3",
      data: { "pedido.findUnique": orderRow({ proforma: [{ id_proforma: "PRF00000005", estado: "anulada" }] }) },
    });

    expect(outcome).toMatchObject(CANCELLED);
  });

  it("con su comprobante anulado: lo cancela", async () => {
    const { outcome } = await runAction({
      name: "C3",
      data: { "pedido.findUnique": orderRow({ comprobante_venta: [{ id_comprobante: "CMP00000004", estado: "anulado" }] }) },
    });

    expect(outcome).toMatchObject(CANCELLED);
  });

  it.each(["vigente", "aceptada", "pagada"])("con una proforma %s: sigue sin cancelarlo", async (estado) => {
    const { outcome } = await runAction({
      name: "C3",
      data: { "pedido.findUnique": orderRow({ proforma: [{ id_proforma: "PRF00000006", estado }] }) },
    });

    expect(outcome).toMatchObject({ status: "error", error: LINKED });
  });
});

// ---------------------------------------------------------------------------
// C4 de la 11.3b (D31): cancelar decide con el pedido bloqueado
// ---------------------------------------------------------------------------

// Cancelar leia el pedido fuera de la transaccion y escribia la cancelacion y su bitacora sin
// ella: una proforma creada en medio dejaba un pedido cancelado con proforma. Ahora el pedido se
// bloquea antes de leerlo y la cancelacion y la bitacora van en la misma transaccion.
describe("C4 de la 11.3b: cancelar decide con el pedido bloqueado", () => {
  const reads = (call: { prisma: string }) => call.prisma === "pedido.findUnique";

  it("cancelar bloquea el pedido antes de leerlo y escribe dentro de la transaccion", async () => {
    const { calls } = await runAction({ name: "C4" });
    const writes = calls.filter((call) => "prisma" in call && call.prisma === "pedido.update");

    expectRowLockedBefore(calls, { table: "pedido", id: PEDIDO, reads });
    expect(writes.map((call) => ("fueraDeTransaccion" in call ? "fuera" : "dentro"))).toEqual(["dentro"]);
    expect(calls.find((call) => "effect" in call && call.effect === "registerAuditLog")).toMatchObject({
      args: { enTransaccion: true },
    });
  });

  it("un rechazo tambien bloquea antes de leer y no escribe", async () => {
    const { calls, outcome } = await runAction({
      name: "C4",
      data: { "pedido.findUnique": orderRow({ proforma: [{ id_proforma: "PRF00000006", estado: "vigente" }] }) },
    });

    expect(outcome).toMatchObject({ status: "error", error: LINKED });
    expectRowLockedBefore(calls, { table: "pedido", id: PEDIDO, reads });
    expect(calls.some((call) => "prisma" in call && call.prisma === "pedido.update")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// C8 de la 11.3b (D34): cancelar con el rechazo en la confirmacion
// ---------------------------------------------------------------------------

describe("C8 de la 11.3b: cancelar con el rechazo en la confirmacion", () => {
  type Calls = Awaited<ReturnType<typeof runAction>>["calls"];

  const revalidated = (calls: Calls) =>
    calls.flatMap((call) => ("effect" in call && call.effect === "revalidatePath" ? [call.args] : []));

  it("cancelado: responde con su estado y revalida el listado y el detalle", async () => {
    const { calls, outcome } = await runAction({ name: "C8" });

    expect(outcome).toMatchObject({ status: "success", data: { estado: "cancelado" } });
    expect(revalidated(calls)).toEqual(["/dashboard/commercial/orders", `/dashboard/commercial/orders/${PEDIDO}`]);
  });

  it.each([
    ["no existe", null, "El pedido no existe."],
    ["ya cancelado", orderRow({ estado: "cancelado" }), "No se puede modificar un pedido cancelado."],
    ["anulado: el mensaje nombra su estado", orderRow({ estado: "anulado" }), "No se puede modificar un pedido anulado."],
    ["con un comprobante emitido", orderRow({ comprobante_venta: [{ id_comprobante: "CMP00000001", estado: "emitido" }] }), LINKED],
  ])("%s: el motivo vuelve a la confirmacion, sin escribir ni revalidar", async (_name, row, message) => {
    const { calls, outcome } = await runAction({ name: "C8", data: { "pedido.findUnique": row } });

    expect(outcome).toMatchObject({ status: "error", error: message, values: { id: PEDIDO } });
    expect(calls.some((call) => "prisma" in call && call.prisma === "pedido.update")).toBe(false);
    expect(revalidated(calls)).toEqual([]);
  });

  it("sin permiso o sin pedido responde en la confirmacion y no consulta nada", async () => {
    const denied = await runAction({ name: "C8", role: "WORKSHOP_MASTER" });
    const empty = await runAction({ name: "C8", id: "" });

    expect(denied.outcome).toMatchObject({ status: "error", error: "No tienes permisos para cancelar pedidos." });
    expect(empty.outcome).toMatchObject({ status: "error", error: "Debe seleccionar un pedido válido." });
    expect([...denied.calls, ...empty.calls].some((call) => "prisma" in call)).toBe(false);
  });
});
