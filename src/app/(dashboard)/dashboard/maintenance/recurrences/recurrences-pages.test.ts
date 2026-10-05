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

// Caracterizacion de Reincidencias (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/recurrences/queries.ts.

definePageSuite([
  {
    route: "/dashboard/maintenance/recurrences",
    load: () => import("./page"),
    cases: [
      { name: "reporte del mes" },
    ],
  },
]);
