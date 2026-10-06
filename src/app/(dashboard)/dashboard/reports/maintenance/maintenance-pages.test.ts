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

// Caracterizacion del reporte de Mantenimiento (entrega 5), escrita antes de
// mover sus consultas a modules/reports/maintenance/queries.ts.

definePageSuite([
  {
    route: "/dashboard/reports/maintenance",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros, maestro de taller", role: "WORKSHOP_MASTER" },
      {
        name: "todos los filtros",
        searchParams: {
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
          machineId: "MAQ00000001",
          failureStatus: "pendiente",
          repairStatus: "ejecutada",
          preventiveStatus: "pendiente",
          searchText: " MAQ-01 ",
        },
      },
      {
        name: "maquina reincidente y preventivo vencido",
        data: {
          "falla_maquina.findMany": rowsFrom("falla_maquina", [
            {
              id_falla: "FAL00000001",
              id_maquina: "MAQ00000001",
              estado_atencion: "pendiente",
            },
            {
              id_falla: "FAL00000002",
              id_maquina: "MAQ00000001",
              estado_atencion: "en_atencion",
            },
            {
              id_falla: "FAL00000003",
              id_maquina: "MAQ00000002",
              estado_atencion: "reparada",
              reparacion: [],
            },
          ]),
          "mantenimiento_preventivo.findMany": rowsFrom("mantenimiento_preventivo", [
            { id_mantenimiento: "MPR00000001", estado: "pendiente" },
            { id_mantenimiento: "MPR00000002", estado: "realizado" },
          ]),
        },
      },
      {
        name: "sin resultados",
        data: {
          "falla_maquina.findMany": rowsFrom("falla_maquina", []),
          "reparacion.findMany": rowsFrom("reparacion", []),
          "mantenimiento_preventivo.findMany": rowsFrom("mantenimiento_preventivo", []),
        },
      },
    ],
  },
]);
