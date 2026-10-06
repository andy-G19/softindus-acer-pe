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

// Caracterizacion del reporte de Costos y rentabilidad (entrega 5), escrita
// antes de mover sus consultas a modules/reports/profitability/queries.ts.

definePageSuite([
  {
    route: "/dashboard/reports/profitability",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: " Estructura ",
          from: "2026-07-01",
          to: "2026-07-31",
          lowMargin: "true",
          negativeProfit: "true",
        },
      },
      {
        name: "costeo sin pedido, orden, margen ni rentabilidad",
        data: {
          "costeo.findMany": rowsFrom("costeo", [
            {
              id_costeo: "COS00000001",
              pedido: null,
              orden_trabajo: null,
              margen_ganancia: [],
              rentabilidad: [],
            },
            { id_costeo: "COS00000002" },
          ]),
        },
      },
      { name: "sin resultados", data: { "costeo.findMany": rowsFrom("costeo", []) } },
    ],
  },
]);
