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

// Caracterizacion de Retazos reutilizables (entrega 4.6), escrita antes
// de mover sus consultas a modules/waste-scrap/reusable-scraps/queries.ts.

definePageSuite([
  {
    route: "/dashboard/waste-scrap/reusable-scraps",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: { estado: "disponible", material: "MAT00000001", q: "plancha" },
      },
    ],
  },
  {
    route: "/dashboard/waste-scrap/reusable-scraps/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
