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

// Caracterizacion de Ingresos y ajustes de caja chica (entrega 4.6), escrita antes
// de mover sus consultas a modules/petty-cash/income-adjustments/queries.ts.

definePageSuite([
  {
    route: "/dashboard/petty-cash/income-adjustments/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
