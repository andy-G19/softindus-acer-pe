import { vi } from "vitest";

import { definePageSuite, type DataOverrides } from "@/testing/page-characterization";

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

// Caracterizacion de Pagos a proveedores (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/supplier-payments/queries.ts.
//
// Entrega 10.3c: lo que pasa hoy con las fechas antes de pasar la barra a
// FilterBar y DateRangeFields (detalle en entries-pages.test.ts). Con el
// rango invertido la base no devuelve filas: el caso deja la lista vacia.
const EMPTY_LIST: DataOverrides = {
  "pago_proveedor.findMany": [],
};

definePageSuite([
  {
    route: "/dashboard/inventory/supplier-payments",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "F001",
          supplier: "PRV00000001",
          purchase: "COM00000001",
          method: "transferencia",
          status: "pagado",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      {
        name: "rango invertido",
        searchParams: { from: "2026-07-31", to: "2026-07-01" },
        data: EMPTY_LIST,
      },
      {
        name: "fechas no validas",
        searchParams: { from: "2026-02-30", to: "2026-07-32" },
      },
    ],
  },
]);
