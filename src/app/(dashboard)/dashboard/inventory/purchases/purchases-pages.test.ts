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

// Caracterizacion de Compras (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/purchases/queries.ts.

definePageSuite([
  {
    route: "/dashboard/inventory/purchases",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "F001",
          supplier: "PRV00000001",
          material: "MAT00000001",
          status: "confirmada",
          payment: "pendiente",
          from: "2026-07-01",
          to: "2026-07-31",
          page: "2",
        },
      },
    ],
  },
  {
    route: "/dashboard/inventory/purchases/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
  {
    route: "/dashboard/inventory/purchases/[id]",
    load: () => import("./[id]/page"),
    cases: [
      {
        name: "detalle con regreso al listado",
        params: { id: "COM00000001" },
        searchParams: { returnTo: "/dashboard/inventory/purchases?payment=pendiente" },
      },
      {
        name: "inexistente redirige al listado",
        params: { id: "COM99999999" },
        data: { "compra.findUnique": null },
      },
    ],
  },
]);
