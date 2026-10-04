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

// Caracterizacion de Pagos a proveedores (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/supplier-payments/queries.ts.

definePageSuite([
  {
    route: "/dashboard/inventory/supplier-payments",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "F001",
          supplier: "PRV00000001",
          purchase: "COM00000001",
          method: "transferencia",
          status: "pagado",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
    ],
  },
]);
