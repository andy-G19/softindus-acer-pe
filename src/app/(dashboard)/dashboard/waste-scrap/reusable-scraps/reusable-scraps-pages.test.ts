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

// Caracterizacion de Retazos reutilizables (entrega 4.6), escrita antes
// de mover sus consultas a modules/waste-scrap/reusable-scraps/queries.ts.

// Un retazo por estado: solo el disponible ofrece acciones.
const scrapsIn =
  (...estados: string[]) =>
  (args: Parameters<typeof generatedRow>[2]) =>
    estados.map((estado, index) => ({
      ...generatedRow("retazo_reutilizable", "findUnique", args),
      id_retazo: `RET0000000${index + 1}`,
      estado,
    }));

definePageSuite([
  {
    route: "/dashboard/waste-scrap/reusable-scraps",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "acciones de cada estado",
        data: {
          "retazo_reutilizable.findMany": scrapsIn("disponible", "reutilizado", "descartado"),
        },
      },
      { name: "sin retazos", data: { "retazo_reutilizable.findMany": [] } },
      {
        name: "todos los filtros",
        searchParams: { estado: "disponible", material: "MAT00000001", q: "plancha" },
      },
    ],
  },
  {
    route: "/dashboard/waste-scrap/reusable-scraps/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
