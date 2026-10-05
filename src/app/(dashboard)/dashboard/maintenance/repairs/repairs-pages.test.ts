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

// Caracterizacion de Reparaciones (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/repairs/queries.ts.

definePageSuite([
  {
    route: "/dashboard/maintenance/repairs",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "rodamiento",
          machine: "torno",
          failure: "FAL",
          status: "ejecutada",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
    ],
  },
  {
    route: "/dashboard/maintenance/repairs/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
