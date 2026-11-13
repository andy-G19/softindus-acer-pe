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

// Caracterizacion de Cajas chicas (entrega 4.6), escrita antes
// de mover sus consultas a modules/petty-cash/boxes/queries.ts.

definePageSuite([
  {
    route: "/dashboard/petty-cash/boxes",
    load: () => import("./page"),
    cases: [
      { name: "listado" },
    ],
  },
  // C7 de la 11.4a: la pagina para abrir caja no tenia caracterizacion. Fija el formulario con
  // resultado (PettyCashBoxForm) y la vuelta: al listado de cajas, o al returnTo valido.
  {
    route: "/dashboard/petty-cash/boxes/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "desde caja chica: vuelve a ella", searchParams: { returnTo: "/dashboard/petty-cash" } },
      { name: "un returnTo externo se ignora", searchParams: { returnTo: "https://example.com/boxes" } },
    ],
  },
]);
