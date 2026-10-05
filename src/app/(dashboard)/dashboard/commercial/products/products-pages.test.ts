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

// Caracterizacion de Productos (entrega 4.2), escrita antes de mover sus
// consultas a modules/commercial/products/queries.ts.

definePageSuite([
  {
    route: "/dashboard/commercial/products",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "filtros y vendedor",
        role: "SELLER",
        searchParams: {
          q: "reja",
          category: "estructuras",
          unit: "unidad",
          status: "active",
          page: "2",
        },
      },
      { name: "inactivos", searchParams: { status: "inactive" } },
      { name: "estado desconocido", searchParams: { status: "todos" } },
    ],
  },
  {
    route: "/dashboard/commercial/products/new",
    load: () => import("./new/page"),
    cases: [{ name: "formulario" }],
  },
  {
    route: "/dashboard/commercial/products/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "PRO00000001" } },
      {
        name: "inexistente",
        params: { id: "PRO99999999" },
        data: { "producto.findUnique": null },
      },
    ],
  },
]);
