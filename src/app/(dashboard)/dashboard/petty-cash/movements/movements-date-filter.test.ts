import { describe, expect, it, vi } from "vitest";

import { parseDateParam } from "@/lib/search-params";
import {
  characterizePage,
  isPrismaCall,
  preloadPages,
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

// C6 de la 11.4b (D51): el filtro de fechas de movimientos de caja chica usaba una copia local
// que cortaba a las T23:59:59 y pasaba a Prisma cualquier texto como fecha. Ahora usa
// parseDateParam y buildDateRangeFilter, como los demas listados: un texto que no es fecha se
// ignora y el ultimo dia llega hasta antes del dia siguiente (timestamptz guarda microsegundos,
// hallazgo 6 de la 10.3a).

const loadPage = () => import("./page");

preloadPages(loadPage);

/** Medianoche en la zona del proceso, como la da parseDateParam. */
function day(year: number, month: number, date: number) {
  return new Date(year, month - 1, date);
}

/** El filtro de fecha de cada consulta de movimientos que hace la pagina con esos parametros. */
async function dateFilters(searchParams: Record<string, string>) {
  const { calls } = await characterizePage(
    loadPage,
    { name: "fechas", searchParams },
    "/dashboard/petty-cash/movements",
  );

  const movementCalls = calls
    .filter(isPrismaCall)
    .filter((call) => call.prisma.startsWith("movimiento_caja."));

  // El listado, el conteo y los cuatro totales filtran con el mismo where.
  expect(movementCalls.map((call) => call.prisma)).toEqual([
    "movimiento_caja.findMany",
    "movimiento_caja.count",
    "movimiento_caja.aggregate",
    "movimiento_caja.aggregate",
    "movimiento_caja.aggregate",
    "movimiento_caja.aggregate",
  ]);

  return movementCalls.map((call) => {
    const args = call.args as PrismaArgs;
    const where = (args?.where ?? {}) as Record<string, unknown>;
    // Los totales envuelven el filtro de la pagina en un AND con su tipo.
    const pageWhere = (Array.isArray(where.AND) ? where.AND[0] : where) as Record<string, unknown>;

    return pageWhere.fecha_movimiento;
  });
}

describe("C6 de la 11.4b: filtro de fechas de movimientos", () => {
  it("un texto que no es fecha no filtra, en lugar de llegar a Prisma como fecha invalida", async () => {
    const filters = await dateFilters({ desde: "abc", hasta: "2026-13-01" });

    expect(filters).toEqual(Array(6).fill(undefined));
  });

  it("el ultimo dia llega hasta antes del dia siguiente", async () => {
    const filters = await dateFilters({ desde: "2026-07-01", hasta: "2026-07-31" });

    expect(filters).toEqual(Array(6).fill({ gte: day(2026, 7, 1), lt: day(2026, 8, 1) }));
  });

  it("solo hasta: lt el dia siguiente, sin lte", async () => {
    const filters = await dateFilters({ hasta: "2026-07-31" });

    expect(filters).toEqual(Array(6).fill({ lt: day(2026, 8, 1) }));
  });

  // Hallazgo 4 de la 10.3c, abierto: parseDateParam pasa «2026-02-30» al 2 de marzo en todos los
  // listados y se resuelve junto con los dias de Lima (hallazgo 3). Movimientos sigue la misma
  // regla que los demas, no una propia.
  it("una fecha que no existe sigue la regla compartida de los listados", async () => {
    const filters = await dateFilters({ desde: "2026-02-30" });

    expect(filters).toEqual(Array(6).fill({ gte: parseDateParam({ desde: "2026-02-30" }, "desde") }));
  });
});
