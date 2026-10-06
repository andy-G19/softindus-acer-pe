import { vi } from "vitest";

import {
  definePageSuite,
  generatedResult,
  type PrismaArgs,
} from "@/testing/page-characterization";

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

type Row = Record<string, unknown>;

// Filas generadas para la llamada, una por cada cambio.
const rowsFrom = (model: string, changes: Row[]) => (args: PrismaArgs) => {
  const rows = generatedResult(model, "findMany", args) as Row[];

  return changes.map((change, index) => ({ ...rows[index % rows.length], ...change }));
};

// Caracterizacion del reporte de Ventas y cobranzas (entrega 5), escrita antes
// de mover sus consultas a modules/reports/sales-collections/queries.ts.

// Pedidos con los cuatro estados de cobranza: con saldo (pagos de cada tipo),
// sin proforma, pagado y sin pago.
function ordersWithCollectionStates(args: PrismaArgs) {
  const [first, second] = generatedResult("pedido", "findMany", args) as Row[];
  const quote = (first.proforma as Row[])[0];
  const payment = (quote.pago_cliente as Row[])[0];
  const emptyQuote = (second.proforma as Row[])[0];

  return [
    {
      ...first,
      id_pedido: "PED00000001",
      proforma: [
        {
          ...quote,
          pago_cliente: ["adelanto", "amortizacion", "cancelacion", "otro"].map(
            (tipo_pago, index) => ({
              ...payment,
              id_pago_cliente: `PCL0000000${index + 1}`,
              tipo_pago,
            }),
          ),
        },
      ],
    },
    { ...second, id_pedido: "PED00000002", proforma: [] },
    {
      ...first,
      id_pedido: "PED00000003",
      proforma: [{ ...quote, saldo: "0", pago_cliente: [] }],
    },
    {
      ...second,
      id_pedido: "PED00000004",
      proforma: [{ ...emptyQuote, adelanto_inicial: null, pago_cliente: [] }],
    },
  ];
}

definePageSuite([
  {
    route: "/dashboard/reports/sales-collections",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros, vendedor", role: "SELLER" },
      {
        name: "todos los filtros",
        searchParams: {
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
          clientId: "CLI00000001",
          orderStatus: "aprobado",
          collectionStatus: "con_saldo",
          searchCode: " pf-0001 ",
        },
      },
      {
        name: "los cuatro estados de cobranza",
        data: { "pedido.findMany": ordersWithCollectionStates },
      },
      {
        name: "filtro por estado de cobranza en memoria",
        searchParams: { collectionStatus: "sin_pago" },
        data: { "pedido.findMany": ordersWithCollectionStates },
      },
      { name: "sin resultados", data: { "pedido.findMany": rowsFrom("pedido", []) } },
    ],
  },
]);
