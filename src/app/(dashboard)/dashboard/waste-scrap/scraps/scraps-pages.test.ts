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

// Caracterizacion de Chatarra (entrega 4.6), escrita antes
// de mover sus consultas a modules/waste-scrap/scraps/queries.ts.

definePageSuite([
  {
    route: "/dashboard/waste-scrap/scraps",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "filtros y maestro de taller",
        role: "WORKSHOP_MASTER",
        searchParams: { estado: "acumulada", material: "MAT00000001", q: "viruta" },
      },
    ],
  },
  {
    route: "/dashboard/waste-scrap/scraps/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
