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

// Caracterizacion de Auditoria (entrega 4.5), escrita antes
// de mover sus consultas a modules/audit/queries.ts.

definePageSuite([
  {
    route: "/dashboard/audit",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "cliente",
          usuario: "USU00000001",
          accion: "crear",
          entidad: "cliente",
          from: "2026-07-01",
          to: "2026-07-31",
          page: "2",
        },
      },
    ],
  },
]);
