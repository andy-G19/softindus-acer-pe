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

// Caracterizacion del Historial de exportaciones (entrega 5), escrita antes de
// mover sus consultas a modules/reports/export-history/queries.ts.

definePageSuite([
  {
    route: "/dashboard/reports/export-history",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
          module: "Reporte financiero",
          format: "pdf",
          status: "generada",
          userId: "USU00000002",
          searchText: " produccion ",
        },
      },
      {
        name: "parametros vacios, con filtros e ilegibles",
        data: {
          "exportacion_datos.findMany": rowsFrom("exportacion_datos", [
            { id_exportacion: "EXP00000001", parametros: null },
            { id_exportacion: "EXP00000002", parametros: "{}" },
            {
              id_exportacion: "EXP00000003",
              formato: "excel",
              parametros: JSON.stringify({ dateFrom: "2026-07-01", status: "" }),
            },
            {
              id_exportacion: "EXP00000004",
              formato: "pdf",
              parametros: JSON.stringify({ status: "" }),
              ruta_archivo: null,
            },
            { id_exportacion: "EXP00000005", parametros: "no es json" },
          ]),
        },
      },
    ],
  },
]);
