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

// Caracterizacion de Categorias de producto (entrega 4.2), escrita antes de
// mover su consulta a modules/commercial/products/queries.ts.

definePageSuite([
  {
    route: "/dashboard/commercial/product-categories",
    load: () => import("./page"),
    cases: [
      { name: "administrador gestiona" },
      { name: "vendedor solo consulta", role: "SELLER" },
    ],
  },
]);
