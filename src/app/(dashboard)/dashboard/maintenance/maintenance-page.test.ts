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

// Caracterizacion de el panel de Mantenimiento (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/overview/queries.ts.

definePageSuite([
  {
    route: "/dashboard/maintenance",
    load: () => import("./page"),
    cases: [
      { name: "indicadores del mes" },
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
    ],
  },
]);
