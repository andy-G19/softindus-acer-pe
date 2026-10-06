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

// Caracterizacion del reporte Financiero (entrega 5), escrita antes de mover
// sus consultas a modules/reports/financial/queries.ts.

definePageSuite([
  {
    route: "/dashboard/reports/financial",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
          cashBoxId: "CCH00000001",
          movementType: "egreso",
          categoryId: "CGA00000001",
          searchText: " Combustible ",
        },
      },
      {
        name: "totales vacios y movimientos por tipo",
        data: {
          "caja_chica.aggregate": { _sum: { saldo_actual: null } },
          "pago_cliente.aggregate": { _sum: { monto_pagado: null } },
          "costeo.aggregate": {
            _sum: {
              costo_total: null,
              costo_materiales: null,
              costo_consumibles: null,
              costo_mano_obra: null,
              costo_indirecto_total: null,
            },
          },
          "rentabilidad.aggregate": {
            _sum: { ingreso_estimado: null, costo_total: null, utilidad_estimada: null },
          },
          "rentabilidad.count": 0,
          "proforma.aggregate": { _sum: { saldo: null } },
          "compra.findMany": rowsFrom("compra", []),
          "movimiento_caja.findMany": rowsFrom("movimiento_caja", [
            {
              id_movimiento_caja: "MCJ00000001",
              tipo_movimiento: "ingreso",
              categoria_gasto: null,
            },
            { id_movimiento_caja: "MCJ00000002", tipo_movimiento: "egreso" },
          ]),
        },
      },
    ],
  },
]);
