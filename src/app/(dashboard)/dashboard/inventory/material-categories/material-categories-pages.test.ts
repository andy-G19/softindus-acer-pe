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

// Caracterizacion de Categorias de material (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/material-categories/queries.ts.

definePageSuite([
  {
    route: "/dashboard/inventory/material-categories",
    load: () => import("./page"),
    cases: [
      { name: "administrador gestiona" },
      { name: "maestro de taller solo consulta", role: "WORKSHOP_MASTER" },
    ],
  },
]);
