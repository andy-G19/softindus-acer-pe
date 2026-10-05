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

// Caracterizacion de Proveedor-material (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/supplier-materials/queries.ts.

definePageSuite([
  {
    route: "/dashboard/inventory/supplier-materials",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          supplier: "PRV00000001",
          material: "MAT00000001",
          availability: "alta",
          status: "inactive",
        },
      },
      { name: "activos", searchParams: { status: "active" } },
    ],
  },
  {
    route: "/dashboard/inventory/supplier-materials/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
  {
    route: "/dashboard/inventory/supplier-materials/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "PVM00000001" } },
      {
        name: "inexistente",
        params: { id: "PVM99999999" },
        data: { "proveedor_material.findUnique": null },
      },
    ],
  },
]);
