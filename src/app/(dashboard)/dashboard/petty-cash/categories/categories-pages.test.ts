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

// Caracterizacion de Categorias de gasto (entrega 4.6), escrita antes
// de mover sus consultas a modules/petty-cash/categories/queries.ts.

definePageSuite([
  {
    route: "/dashboard/petty-cash/categories",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      { name: "busqueda y activas", searchParams: { q: "transporte", status: "active" } },
      { name: "inactivas", searchParams: { status: "inactive" } },
    ],
  },
  {
    route: "/dashboard/petty-cash/categories/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "CGA00000001" } },
      {
        name: "inexistente",
        params: { id: "CGA99999999" },
        data: { "categoria_gasto.findUnique": null },
      },
    ],
  },
]);
