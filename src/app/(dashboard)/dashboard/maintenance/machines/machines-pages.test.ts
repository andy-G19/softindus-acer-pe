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

// Caracterizacion de Maquinas (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/machines/queries.ts.

definePageSuite([
  {
    route: "/dashboard/maintenance/machines",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "filtros y maestro de taller",
        role: "WORKSHOP_MASTER",
        searchParams: {
          q: "torno",
          type: "torno",
          location: "nave 1",
          status: "operativa",
        },
      },
    ],
  },
  {
    route: "/dashboard/maintenance/machines/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      {
        name: "editar con regreso al listado",
        params: { id: "MAQ00000001" },
        searchParams: { returnTo: "/dashboard/maintenance/machines?status=operativa" },
      },
      {
        name: "inexistente",
        params: { id: "MAQ99999999" },
        data: { "maquina.findUnique": null },
      },
    ],
  },
]);
