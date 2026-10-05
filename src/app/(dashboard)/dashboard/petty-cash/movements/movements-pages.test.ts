import { vi } from "vitest";

import { definePageSuite } from "@/testing/page-characterization";

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

definePageSuite([
  {
    route: "/dashboard/petty-cash/movements",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
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
      },
      { name: "solo desde", searchParams: { desde: "2026-07-01" } },
      { name: "solo hasta", searchParams: { hasta: "2026-07-31" } },
    ],
  },
]);
