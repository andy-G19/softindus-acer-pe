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

// Caracterizacion del reporte de Proveedores y compras (entrega 5), escrita
// antes de mover sus consultas a modules/reports/suppliers-purchases/queries.ts.

definePageSuite([
  {
    route: "/dashboard/reports/suppliers-purchases",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
          supplierId: "PRV00000001",
          materialId: "MAT00000001",
          purchaseStatus: "confirmada",
          paymentStatus: "parcial",
          searchCode: " f001 ",
        },
      },
      {
        name: "estados de pago y compra sin detalle, pagos ni historial",
        data: {
          "compra.findMany": rowsFrom("compra", [
            {
              id_compra: "COM00000001",
              estado_pago: "pendiente",
              detalle_compra: [],
              pago_proveedor: [],
              historial_precio_proveedor: [],
            },
            { id_compra: "COM00000002", estado_pago: "parcial" },
            { id_compra: "COM00000003", estado_pago: "pagado" },
          ]),
        },
      },
      { name: "sin resultados", data: { "compra.findMany": rowsFrom("compra", []) } },
    ],
  },
]);
