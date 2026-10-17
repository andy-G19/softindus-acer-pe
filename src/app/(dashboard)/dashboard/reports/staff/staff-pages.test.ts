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

// Caracterizacion del reporte de Personal y planillas (entrega 5), escrita
// antes de mover sus consultas a modules/reports/staff/queries.ts.

definePageSuite([
  {
    route: "/dashboard/reports/staff",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: " Quispe ",
          operario: "OPE00000001",
          modalidad: "semanal",
          estado: "pagado",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      {
        name: "planilla pendiente sin pagos y sin asistencias",
        data: {
          "planilla_pago.findMany": rowsFrom("planilla_pago", [
            {
              id_planilla: "PLA00000001",
              estado_pago: "pendiente",
              historial_pago_operario: [],
            },
          ]),
          "asistencia.count": 0,
        },
      },
      // Entrega 10.2: lo que pasa hoy con un rango invertido y con uno de mas
      // de 366 dias; la exportacion rechaza los dos con un 400.
      {
        name: "rango invertido",
        searchParams: { from: "2026-07-31", to: "2026-07-01" },
      },
      {
        name: "rango de mas de 366 dias",
        searchParams: { from: "2025-01-01", to: "2026-07-31" },
      },
    ],
  },
]);
