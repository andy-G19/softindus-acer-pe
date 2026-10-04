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

// Caracterizacion de Proveedores (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/suppliers/queries.ts.

definePageSuite([
  {
    route: "/dashboard/inventory/suppliers",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "acero",
          type: "distribuidor",
          payment: "contado",
          status: "active",
        },
      },
      { name: "inactivos", searchParams: { status: "inactive" } },
    ],
  },
  {
    route: "/dashboard/inventory/suppliers/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
  {
    route: "/dashboard/inventory/suppliers/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "PRV00000001" } },
      {
        name: "inexistente",
        params: { id: "PRV99999999" },
        data: { "proveedor.findUnique": null },
      },
    ],
  },
]);
