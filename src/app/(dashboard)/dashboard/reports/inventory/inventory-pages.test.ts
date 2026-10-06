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

// Caracterizacion del reporte de Inventario (entrega 5), escrita antes de
// mover sus consultas a modules/reports/inventory/queries.ts.

definePageSuite([
  {
    route: "/dashboard/reports/inventory",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          dateFrom: "2026-07-01",
          dateTo: "2026-07-15",
          materialId: "MAT00000001",
          movementType: "salida",
          userId: "USU00000002",
          workOrderId: "otr00000001",
        },
      },
      {
        name: "tipos de movimiento, sin orden ni compra",
        data: {
          "movimiento_inventario.findMany": rowsFrom("movimiento_inventario", [
            {
              id_movimiento: "MVI00000001",
              tipo_movimiento: "entrada",
              orden_trabajo: null,
              compra: null,
            },
            { id_movimiento: "MVI00000002", tipo_movimiento: "salida" },
            { id_movimiento: "MVI00000003", tipo_movimiento: "reserva" },
            { id_movimiento: "MVI00000004", tipo_movimiento: "ajuste" },
          ]),
        },
      },
      {
        name: "sin resultados",
        data: { "movimiento_inventario.findMany": rowsFrom("movimiento_inventario", []) },
      },
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
    ],
  },
]);
