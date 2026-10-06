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

// Caracterizacion del reporte de Produccion (entrega 5), escrita antes de mover
// sus consultas a modules/reports/production/queries.ts.

definePageSuite([
  {
    route: "/dashboard/reports/production",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
          productId: "PRO00000001",
          status: "en_proceso",
          orderId: " otr0000 ",
        },
      },
      {
        name: "orden retrasada sin cliente, ruta ni avances",
        data: {
          "orden_trabajo.findMany": rowsFrom("orden_trabajo", [
            {
              id_orden_trabajo: "OTR00000001",
              estado: "pendiente",
              cliente: null,
              ruta_fabricacion: null,
              avance_orden: [],
            },
            { id_orden_trabajo: "OTR00000002", estado: "finalizada" },
          ]),
        },
      },
      { name: "sin resultados", data: { "orden_trabajo.findMany": rowsFrom("orden_trabajo", []) } },
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
    ],
  },
]);
