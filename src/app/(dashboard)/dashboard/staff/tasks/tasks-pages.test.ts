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

// Caracterizacion de Tareas de operarios (entrega 4.5), escrita antes
// de mover sus consultas a modules/staff/tasks/queries.ts.

definePageSuite([
  {
    route: "/dashboard/staff/tasks",
    load: () => import("./page"),
    cases: [
      { name: "administrador" },
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
    ],
  },
  {
    route: "/dashboard/staff/tasks/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
