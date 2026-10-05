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

// Caracterizacion de Cuellos de botella (entrega 4.7), escrita antes
// de mover sus consultas a modules/production/bottlenecks/queries.ts.

definePageSuite([
  {
    route: "/dashboard/production/bottlenecks",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          product: "PRO00000001",
          route: "RUT00000001",
          stage: "ETR00000001",
          orderStatus: "en_proceso",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      { name: "solo desde", searchParams: { from: "2026-07-01" } },
    ],
  },
]);
