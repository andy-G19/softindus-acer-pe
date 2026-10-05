import { vi } from "vitest";

import { definePageSuite, generatedRow } from "@/testing/page-characterization";

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

// Caracterizacion de Pedidos (entrega 4.2), escrita antes de mover sus
// consultas a modules/commercial/orders/queries.ts.

// Pedido sin proformas, comprobantes ni ordenes de trabajo: el unico caso en
// que la edicion muestra el formulario en lugar de redirigir al detalle.
const editableOrder = (args: Parameters<typeof generatedRow>[2]) => {
  const order = generatedRow("pedido", "findUnique", args);
  const details = order.detalle_pedido as Array<Record<string, unknown>>;

  return {
    ...order,
    estado: "registrado",
    proforma: [],
    comprobante_venta: [],
    detalle_pedido: details.map((detail) => ({ ...detail, orden_trabajo: [] })),
  };
};

definePageSuite([
  {
    route: "/dashboard/commercial/orders",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "PED",
          client: "CLI00000001",
          product: "PRO00000001",
          status: "aprobado",
          from: "2026-07-01",
          to: "2026-07-31",
          page: "2",
        },
      },
    ],
  },
  {
    route: "/dashboard/commercial/orders/new",
    load: () => import("./new/page"),
    cases: [{ name: "formulario" }],
  },
  {
    route: "/dashboard/commercial/orders/[id]",
    load: () => import("./[id]/page"),
    cases: [
      { name: "detalle", params: { id: "PED00000001" } },
      {
        name: "regreso al listado filtrado",
        params: { id: "PED00000001" },
        searchParams: { returnTo: "/dashboard/commercial/orders?status=aprobado" },
      },
      {
        name: "inexistente",
        params: { id: "PED99999999" },
        data: { "pedido.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/commercial/orders/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "con proforma redirige al detalle", params: { id: "PED00000001" } },
      {
        name: "editable",
        params: { id: "PED00000001" },
        data: { "pedido.findUnique": editableOrder },
      },
      {
        name: "inexistente",
        params: { id: "PED99999999" },
        data: { "pedido.findUnique": null },
      },
    ],
  },
]);
