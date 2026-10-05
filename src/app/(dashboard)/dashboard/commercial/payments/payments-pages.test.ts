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

// Caracterizacion de Pagos de clientes (entrega 4.2), escrita antes de mover
// sus consultas a modules/commercial/payments/queries.ts.

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
    ],
  },
]);
