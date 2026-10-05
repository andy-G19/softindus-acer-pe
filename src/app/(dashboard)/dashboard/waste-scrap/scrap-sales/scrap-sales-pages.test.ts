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

// Caracterizacion de Ventas de chatarra (entrega 4.6), escrita antes
// de mover sus consultas a modules/waste-scrap/scrap-sales/queries.ts.

definePageSuite([
  {
    route: "/dashboard/waste-scrap/scrap-sales/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "chatarra preseleccionada", searchParams: { id_chatarra: "id_chatarra-1" } },
    ],
  },
]);
