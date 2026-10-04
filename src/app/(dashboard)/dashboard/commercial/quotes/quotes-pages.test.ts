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

// Caracterizacion de Proformas (entrega 4.2), escrita antes de mover sus
// consultas a modules/commercial/quotes/queries.ts.

// Proforma vigente sin pagos ni comprobantes: el caso en que se puede anular.
const annullableQuote = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("proforma", "findUnique", args),
  estado: "vigente",
  pago_cliente: [],
  comprobante_venta: [],
});

definePageSuite([
  {
    route: "/dashboard/commercial/quotes",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros con saldo pendiente",
        searchParams: {
          q: "PRF",
          client: "CLI00000001",
          order: "PED00000001",
          status: "vigente",
          balance: "pending",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      { name: "saldo pagado", searchParams: { balance: "paid" } },
    ],
  },
  {
    route: "/dashboard/commercial/quotes/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "pedido preseleccionado", searchParams: { orderId: "id_pedido-1" } },
    ],
  },
  {
    route: "/dashboard/commercial/quotes/[id]",
    load: () => import("./[id]/page"),
    cases: [
      { name: "detalle", params: { id: "PRF00000001" } },
      {
        name: "anulable",
        params: { id: "PRF00000001" },
        data: { "proforma.findUnique": annullableQuote },
      },
      {
        name: "inexistente",
        params: { id: "PRF99999999" },
        data: { "proforma.findUnique": null },
      },
    ],
  },
]);
