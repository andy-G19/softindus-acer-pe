import { vi } from "vitest";

import { definePageSuite, generatedRow } from "@/testing/page-characterization";

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

// Caracterizacion de Repuestos (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/spare-parts/queries.ts.

// Repuesto sin proveedor: las opciones de proveedor no agregan el actual.
const sparePartWithoutSupplier = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("repuesto", "findUnique", args),
  id_proveedor: null,
});

definePageSuite([
  {
    route: "/dashboard/maintenance/spare-parts",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: { q: "rodamiento", provider: "PRV00000001", status: "active" },
      },
      { name: "inactivos", searchParams: { status: "inactive" } },
    ],
  },
  {
    route: "/dashboard/maintenance/spare-parts/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
  {
    route: "/dashboard/maintenance/spare-parts/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar con proveedor", params: { id: "REP00000001" } },
      {
        name: "editar sin proveedor",
        params: { id: "REP00000002" },
        data: { "repuesto.findUnique": sparePartWithoutSupplier },
      },
      {
        name: "inexistente",
        params: { id: "REP99999999" },
        data: { "repuesto.findUnique": null },
      },
    ],
  },
]);
