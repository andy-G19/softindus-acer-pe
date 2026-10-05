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

// Caracterizacion de Fallas (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/failures/queries.ts.

definePageSuite([
  {
    route: "/dashboard/maintenance/failures",
    load: () => import("./page"),
    cases: [
      { name: "administrador" },
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
    ],
  },
  {
    route: "/dashboard/maintenance/failures/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
