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

// Caracterizacion de Comprobantes (entrega 4.2), escrita antes de mover su
// consulta a modules/commercial/receipts/queries.ts.

definePageSuite([
  {
    route: "/dashboard/commercial/receipts",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "B001",
          type: "boleta",
          status: "emitido",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
    ],
  },
]);
