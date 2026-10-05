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

// Caracterizacion de Tipos de proveedor (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/supplier-types/queries.ts.

definePageSuite([
  {
    route: "/dashboard/inventory/supplier-types",
    load: () => import("./page"),
    cases: [
      { name: "catalogo" },
    ],
  },
]);
