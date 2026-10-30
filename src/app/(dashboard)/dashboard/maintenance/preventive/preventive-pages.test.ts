import { vi } from "vitest";

import {
  definePageSuite,
  generatedResult,
  type PrismaArgs,
} from "@/testing/page-characterization";

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

// Caracterizacion de Mantenimientos preventivos (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/preventive/queries.ts.
// La 10.5b agrega un mantenimiento en cada estado guardado y dos pendientes:
// uno con fecha pasada, que la pagina muestra «Vencido» y preselecciona en su
// selector, y otro con fecha futura. El reloj del arnes esta fijo el
// 2026-07-15. Realizados y anulados muestran «Sin accion».

const PREVENTIVE_ROWS = [
  { estado: "pendiente", fecha_programada: "2026-07-20" },
  { estado: "pendiente", fecha_programada: "2026-07-10" },
  { estado: "vencido", fecha_programada: "2026-07-05" },
  { estado: "realizado", fecha_programada: "2026-07-01", fecha_realizada: "2026-07-02" },
  { estado: "anulado", fecha_programada: "2026-06-28" },
];

const maintenancesInEveryState = (args: PrismaArgs) => {
  const [first] = generatedResult("mantenimiento_preventivo", "findMany", args) as Record<string, unknown>[];

  return PREVENTIVE_ROWS.map((row, index) => ({
    ...first,
    id_mantenimiento: `MTP0000000${index + 1}`,
    actividad: `Mantenimiento ${row.estado} ${row.fecha_programada}`,
    estado: row.estado,
    fecha_programada: new Date(`${row.fecha_programada}T00:00:00.000Z`),
    fecha_realizada: row.fecha_realizada ? new Date(`${row.fecha_realizada}T00:00:00.000Z`) : null,
  }));
};

definePageSuite([
  {
    route: "/dashboard/maintenance/preventive",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "lubricacion",
          machine: "torno",
          responsible: "juan",
          status: "pendiente",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      {
        name: "un mantenimiento en cada estado",
        data: { "mantenimiento_preventivo.findMany": maintenancesInEveryState },
      },
    ],
  },
  {
    route: "/dashboard/maintenance/preventive/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
