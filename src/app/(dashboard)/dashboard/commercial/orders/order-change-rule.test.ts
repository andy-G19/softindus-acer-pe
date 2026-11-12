import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  generatedResult,
  generatedRow,
  preloadPages,
  type DataOverrides,
  type PrismaArgs,
} from "@/testing/page-characterization";

// C3 de la 11.3b (D30): una sola regla para saber si un pedido se puede editar o cancelar. La
// bloquean una proforma activa (vigente, aceptada o pagada), un comprobante emitido, una orden de
// trabajo y los estados cancelado y anulado. Antes habia tres reglas: el listado solo miraba las
// proformas activas y no miraba el estado anulado; la edicion y la accion contaban cualquier
// proforma y cualquier comprobante, tambien anulados; y la edicion no miraba el estado anulado
// (hallazgo 1 de la 10.4c). Un pedido cuya unica proforma se anulo ofrecia «Editar» y
// «Cancelar», y los dos fallaban sin decir por que.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock(),
);
vi.mock("@/lib/authz", async () =>
  (await import("@/testing/page-characterization")).authzModuleMock(),
);
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);

// La primera importacion de una pagina transforma todos sus componentes y bajo la carga de la
// suite supera el plazo de una prueba: se precargan una vez, como en definePageSuite.
preloadPages(() => import("./[id]/edit/page"), () => import("./page"));

const PEDIDO = "PED00000021";

/** Pedido registrado sin nada que lo bloquee, salvo lo que el caso cambie. */
function editRow(changes: Record<string, unknown>) {
  return (args: PrismaArgs) => {
    const order = generatedRow("pedido", "findUnique", args);
    const details = order.detalle_pedido as Array<Record<string, unknown>>;

    return {
      ...order,
      id_pedido: PEDIDO,
      estado: "registrado",
      proforma: [],
      comprobante_venta: [],
      detalle_pedido: details.map((detail) => ({ ...detail, orden_trabajo: [] })),
      ...changes,
    };
  };
}

function listWith(changes: Record<string, unknown>) {
  return (args: PrismaArgs) => {
    const [base] = generatedResult("pedido", "findMany", args) as Record<string, unknown>[];
    const details = base.detalle_pedido as Array<Record<string, unknown>>;

    return [
      {
        ...base,
        id_pedido: PEDIDO,
        estado: "registrado",
        proforma: [],
        comprobante_venta: [],
        detalle_pedido: details.map((detail) => ({ ...detail, orden_trabajo: [] })),
        ...changes,
      },
    ];
  };
}

const annulledQuote = [{ id_proforma: "PRF00000005", numero_proforma: "PF-00000005", estado: "anulada" }];
const annulledReceipt = [{ id_comprobante: "CMP00000004", estado: "anulado" }];

const editPage = (data: DataOverrides) =>
  characterizePage(() => import("./[id]/edit/page"), { name: "C3", params: { id: PEDIDO }, data }, `/dashboard/commercial/orders/${PEDIDO}/edit`);

const listPage = (data: DataOverrides) =>
  characterizePage(() => import("./page"), { name: "C3", data: { "pedido.count": 1, ...data } }, "/dashboard/commercial/orders");

/** Los botones que la fila del pedido ofrece para cambiarlo. */
function changeButtons(html: string | null) {
  const editLink = html?.includes(`/dashboard/commercial/orders/${PEDIDO}/edit`) ?? false;
  const cancel = /Cancelar<\/button>|>Cancelar</.test(html ?? "");

  return { editar: editLink, cancelar: cancel };
}

describe("C3 de la 11.3b: la edicion aplica la regla del pedido", () => {
  it("un pedido anulado no abre la edicion: vuelve al detalle (hallazgo 1 de la 10.4c)", async () => {
    const { outcome } = await editPage({ "pedido.findUnique": editRow({ estado: "anulado" }) });

    expect(outcome).toBe(`redirect:/dashboard/commercial/orders/${PEDIDO}`);
  });

  it("un pedido con su proforma anulada abre la edicion", async () => {
    const { outcome } = await editPage({ "pedido.findUnique": editRow({ proforma: annulledQuote }) });

    expect(outcome).toBe("render");
  });

  it("un pedido con su comprobante anulado abre la edicion", async () => {
    const { outcome } = await editPage({ "pedido.findUnique": editRow({ comprobante_venta: annulledReceipt }) });

    expect(outcome).toBe("render");
  });

  it("un pedido con una proforma vigente sigue volviendo al detalle", async () => {
    const { outcome } = await editPage({
      "pedido.findUnique": editRow({ proforma: [{ id_proforma: "PRF00000006", estado: "vigente" }] }),
    });

    expect(outcome).toBe(`redirect:/dashboard/commercial/orders/${PEDIDO}`);
  });
});

describe("C3 de la 11.3b: el listado aplica la regla del pedido", () => {
  it("un pedido anulado no ofrece «Editar» ni «Cancelar»", async () => {
    const { html } = await listPage({ "pedido.findMany": listWith({ estado: "anulado" }) });

    expect(changeButtons(html)).toEqual({ editar: false, cancelar: false });
  });

  it("un pedido con su comprobante anulado ofrece «Editar» y «Cancelar»", async () => {
    const { html } = await listPage({ "pedido.findMany": listWith({ comprobante_venta: annulledReceipt }) });

    expect(changeButtons(html)).toEqual({ editar: true, cancelar: true });
  });

  it("un pedido con un comprobante emitido no los ofrece", async () => {
    const { html } = await listPage({
      "pedido.findMany": listWith({ comprobante_venta: [{ id_comprobante: "CMP00000005", estado: "emitido" }] }),
    });

    expect(changeButtons(html)).toEqual({ editar: false, cancelar: false });
  });
});
