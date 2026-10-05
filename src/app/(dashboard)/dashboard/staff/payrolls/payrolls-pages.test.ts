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

// Caracterizacion de Planillas (entrega 4.5), escrita antes
// de mover sus consultas a modules/staff/payrolls/queries.ts.

definePageSuite([
  {
    route: "/dashboard/staff/payrolls",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "quispe",
          operario: "OPE",
          periodo: "2026-07",
          modalidad: "semanal",
          estado: "pendiente",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      { name: "periodo con formato invalido", searchParams: { periodo: "2026-7" } },
    ],
  },
  {
    route: "/dashboard/staff/payrolls/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
