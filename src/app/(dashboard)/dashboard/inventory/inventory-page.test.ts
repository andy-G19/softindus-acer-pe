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

// Caracterizacion de el panel de Inventario (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/overview/queries.ts. El caso del
// maestro de taller (entrega 10.3c) fija las tarjetas que ve antes de que el
// inicio muestre solo los modulos que su rol puede abrir.

definePageSuite([
  {
    route: "/dashboard/inventory",
    load: () => import("./page"),
    cases: [
      { name: "indicadores" },
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
    ],
  },
]);
