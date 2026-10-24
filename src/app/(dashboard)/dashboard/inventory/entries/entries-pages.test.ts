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

// Caracterizacion de Entradas de inventario (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/movements/queries.ts.
//
// Entrega 10.3c: lo que pasa hoy con las fechas antes de pasar la barra a
// FilterBar y DateRangeFields. Con el rango invertido la consulta pide un
// "desde" posterior al "hasta" y la base no devuelve filas; los datos
// generados si las darian, asi que el caso deja la lista vacia. Las fechas
// que no existen las interpreta parseDateParam: el 30 de febrero pasa al 2 de
// marzo y el dia 32 no filtra. El maestro de taller fija los enlaces que ve.
const EMPTY_LIST: DataOverrides = {
  "movimiento_inventario.findMany": [],
  "movimiento_inventario.count": 0,
};

definePageSuite([
  {
    route: "/dashboard/inventory/entries",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "COM",
          material: "MAT00000001",
          supplier: "PRV00000001",
          purchase: "COM00000001",
          from: "2026-07-01",
          to: "2026-07-31",
          page: "2",
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
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
    ],
  },
]);
