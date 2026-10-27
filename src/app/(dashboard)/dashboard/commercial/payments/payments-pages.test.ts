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

// Caracterizacion de Pagos de clientes (entrega 4.2), escrita antes de mover
// sus consultas a modules/commercial/payments/queries.ts.
//
// Entrega 10.4b: lo que pasa hoy con las fechas antes de pasar la barra a
// FilterBar y DateRangeFields (detalle en orders-pages.test.ts). Los datos
// generados dan un tipo y un metodo que no existen: el caso con valores
// reales fija que la tabla los muestra tal como se guardan («amortizacion»),
// no con el texto de los filtros («Amortización»).
const PAYMENTS_WITH_REAL_VALUES = (args: PrismaArgs) => {
  const [first, second] = generatedResult("pago_cliente", "findMany", args) as Record<string, unknown>[];

  return [
    { ...first, tipo_pago: "adelanto", metodo_pago: "efectivo" },
    { ...second, tipo_pago: "amortizacion", metodo_pago: "transferencia" },
    { ...first, id_pago_cliente: "PCL00000013", tipo_pago: "cancelacion", metodo_pago: "yape" },
  ];
};

definePageSuite([
  {
    route: "/dashboard/commercial/payments",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "PRO",
          client: "CLI00000001",
          order: "PED00000001",
          method: "efectivo",
          type: "adelanto",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      {
        name: "rango invertido",
        searchParams: { from: "2026-07-31", to: "2026-07-01" },
        data: { "pago_cliente.findMany": [] },
      },
      {
        name: "fechas no validas",
        searchParams: { from: "2026-02-30", to: "2026-07-32" },
      },
      {
        name: "tipos y metodos reales",
        data: { "pago_cliente.findMany": PAYMENTS_WITH_REAL_VALUES },
      },
    ],
  },
]);
