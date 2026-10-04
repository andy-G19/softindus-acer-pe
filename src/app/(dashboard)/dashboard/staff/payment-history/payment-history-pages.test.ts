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

// Caracterizacion de Historial de pagos (entrega 4.5), escrita antes
// de mover sus consultas a modules/staff/payment-history/queries.ts.

definePageSuite([
  {
    route: "/dashboard/staff/payment-history",
    load: () => import("./page"),
    cases: [
      { name: "pagos del mes" },
    ],
  },
  {
    route: "/dashboard/staff/payment-history/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
