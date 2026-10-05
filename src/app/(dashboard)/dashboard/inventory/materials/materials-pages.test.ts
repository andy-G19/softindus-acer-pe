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

// Caracterizacion de Materiales (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/materials/queries.ts.

definePageSuite([
  {
    route: "/dashboard/inventory/materials",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "filtros y maestro de taller",
        role: "WORKSHOP_MASTER",
        searchParams: {
          q: "plancha",
          category: "materia_prima",
          unit: "kg",
          status: "active",
          page: "2",
        },
      },
      { name: "inactivos", searchParams: { status: "inactive" } },
      { name: "stock critico paginado en memoria", searchParams: { stock: "critical", pageSize: "1" } },
      { name: "stock suficiente", searchParams: { stock: "ok" } },
    ],
  },
  {
    route: "/dashboard/inventory/materials/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
  {
    route: "/dashboard/inventory/materials/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      {
        name: "editar con regreso al listado",
        params: { id: "MAT00000001" },
        searchParams: { returnTo: "/dashboard/inventory/materials?status=active" },
      },
      {
        name: "inexistente",
        params: { id: "MAT99999999" },
        data: { "material.findUnique": null },
      },
    ],
  },
]);
