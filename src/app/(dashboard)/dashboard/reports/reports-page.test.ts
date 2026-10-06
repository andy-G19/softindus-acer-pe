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

// Caracterizacion del panel de Reportes (entrega 5), escrita antes de mover
// sus consultas a modules/reports/overview/queries.ts.

definePageSuite([
  {
    route: "/dashboard/reports",
    load: () => import("./page"),
    cases: [
      { name: "panel del mes" },
      {
        name: "sin datos recientes, totales vacios ni materiales criticos",
        data: {
          "material.findMany": rowsFrom("material", [
            { id_material: "MAT00000001", stock_actual: "30", stock_minimo: "5" },
            { id_material: "MAT00000002", stock_actual: "8", stock_minimo: "2" },
          ]),
          "orden_trabajo.findMany": [],
          "movimiento_caja.findMany": [],
          "pago_cliente.aggregate": { _sum: { monto_pagado: null } },
          "comprobante_venta.aggregate": { _sum: { monto_total: null } },
          "proforma.aggregate": { _sum: { saldo: null } },
          "caja_chica.aggregate": { _sum: { saldo_actual: null } },
          "movimiento_caja.aggregate": { _sum: { monto: null } },
          "rentabilidad.aggregate": { _sum: { utilidad_estimada: null } },
          "reparacion.aggregate": { _sum: { costo_total: null } },
          "compra.aggregate": { _sum: { monto_total: null } },
          "rentabilidad.count": 0,
          "falla_maquina.count": 0,
          "mantenimiento_preventivo.count": 0,
          "compra.count": 0,
          "orden_trabajo.count": 0,
        },
      },
    ],
  },
]);
