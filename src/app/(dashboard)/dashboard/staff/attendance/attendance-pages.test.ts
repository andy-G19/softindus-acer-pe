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

// Caracterizacion de Asistencia (entrega 4.5), escrita antes
// de mover sus consultas a modules/staff/attendance/queries.ts.

definePageSuite([
  {
    route: "/dashboard/staff/attendance",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros con presentes",
        searchParams: {
          q: "quispe",
          operario: "OPE",
          estado: "presente",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      { name: "tardanzas", searchParams: { estado: "tardanza" } },
      { name: "faltas", searchParams: { estado: "falta" } },
    ],
  },
  {
    route: "/dashboard/staff/attendance/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
