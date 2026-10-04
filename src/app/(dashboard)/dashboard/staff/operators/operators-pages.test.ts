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

// Caracterizacion de Operarios (entrega 4.5), escrita antes
// de mover sus consultas a modules/staff/operators/queries.ts.

definePageSuite([
  {
    route: "/dashboard/staff/operators",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "filtros y maestro de taller",
        role: "WORKSHOP_MASTER",
        searchParams: {
          q: "juan",
          cargo: "soldador",
          especialidad: "estructuras",
          modalidad: "diario",
          status: "activo",
        },
      },
    ],
  },
  {
    route: "/dashboard/staff/operators/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "OPE00000001" } },
      {
        name: "inexistente",
        params: { id: "OPE99999999" },
        data: { "operario.findUnique": null },
      },
    ],
  },
]);
