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

// Caracterizacion de el panel de Produccion (entrega 4.7), escrita antes
// de mover sus consultas a modules/production/overview/queries.ts.

definePageSuite([
  {
    route: "/dashboard/production",
    load: () => import("./page"),
    cases: [
      { name: "indicadores" },
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
    ],
  },
]);
