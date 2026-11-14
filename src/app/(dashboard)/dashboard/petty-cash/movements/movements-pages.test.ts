import { vi } from "vitest";

import {
  definePageSuite,
  generatedResult,
  type DataOverrides,
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

// Caracterizacion de Movimientos de caja chica (entrega 4.6), escrita antes
// de mover sus consultas a modules/petty-cash/movements/queries.ts.
//
// C5 de la 11.4b: la consulta trae la venta de chatarra de cada movimiento, y el arnes la genera
// con una venta en cada fila, que ya no ofrece «Anular». Estos casos fijan movimientos sin venta,
// los de siempre; el ingreso de una venta tiene su prueba en movements-sale-income.test.ts.
const WITHOUT_SALE: DataOverrides = {
  "movimiento_caja.findMany": (args: PrismaArgs) =>
    (generatedResult("movimiento_caja", "findMany", args) as Record<string, unknown>[]).map((row) => ({
      ...row,
      venta_chatarra: [],
    })),
};

definePageSuite([
  {
    route: "/dashboard/petty-cash/movements",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros", data: WITHOUT_SALE },
      {
        name: "todos los filtros",
        searchParams: {
          caja: "CCH00000001",
          tipo: "egreso",
          categoria: "CGA00000001",
          desde: "2026-07-01",
          hasta: "2026-07-31",
          q: "combustible",
          page: "2",
        },
        data: WITHOUT_SALE,
      },
      { name: "solo desde", searchParams: { desde: "2026-07-01" }, data: WITHOUT_SALE },
      { name: "solo hasta", searchParams: { hasta: "2026-07-31" }, data: WITHOUT_SALE },
    ],
  },
]);
