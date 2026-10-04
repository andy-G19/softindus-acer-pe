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

// Caracterizacion de el panel de Personal (entrega 4.5), escrita antes
// de mover sus consultas a modules/staff/overview/queries.ts.

definePageSuite([
  {
    route: "/dashboard/staff",
    load: () => import("./page"),
    cases: [
      { name: "indicadores del dia y del mes" },
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
    ],
  },
]);
