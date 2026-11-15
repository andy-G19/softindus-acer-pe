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

// Caracterizacion de Planillas (entrega 4.5), escrita antes
// de mover sus consultas a modules/staff/payrolls/queries.ts.

type Row = Record<string, unknown>;

// C8 de la 11.5 (D60): las filas generadas no estan pendientes y muestran «Sin accion», asi que
// ningun caso veia el boton de anular. La primera fila pendiente y sin pagos es la que lo ofrece;
// la segunda, anulada y tambien sin pagos, no: lo que decide es el estado, no solo los pagos.
const PENDING_FIRST = {
  "planilla_pago.findMany": (args: PrismaArgs) =>
    (generatedResult("planilla_pago", "findMany", args) as Row[]).map((row, index) =>
      index === 0
        ? { ...row, estado_pago: "pendiente", _count: { historial_pago_operario: 0 } }
        : { ...row, estado_pago: "anulada", _count: { historial_pago_operario: 0 } },
    ),
};

definePageSuite([
  {
    route: "/dashboard/staff/payrolls",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "quispe",
          operario: "OPE",
          periodo: "2026-07",
          modalidad: "semanal",
          estado: "pendiente",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      { name: "periodo con formato invalido", searchParams: { periodo: "2026-7" } },
      { name: "una planilla pendiente sin pagos ofrece anular", data: PENDING_FIRST },
      // C9 de la 11.5 (D61): paginado con los filtros; la segunda pagina salta las primeras 20. El
      // total de la paginacion es el conteo con el filtro del listado (45), no el de las tarjetas
      // por estado (7): con todos los conteos iguales no se distinguian.
      {
        name: "segunda pagina con un filtro",
        searchParams: { estado: "pendiente", page: "2" },
        data: {
          "planilla_pago.count": (args: PrismaArgs) => ("AND" in ((args?.where as object | undefined) ?? {}) ? 45 : 7),
        },
      },
    ],
  },
  {
    route: "/dashboard/staff/payrolls/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
