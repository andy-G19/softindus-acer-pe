import { describe, expect, it, vi } from "vitest";

import { characterizePage, definePageSuite, isPrismaCall } from "@/testing/page-characterization";

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

// Caracterizacion de Cuellos de botella (entrega 4.7), escrita antes
// de mover sus consultas a modules/production/bottlenecks/queries.ts.

definePageSuite([
  {
    route: "/dashboard/production/bottlenecks",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          product: "PRO00000001",
          route: "RUT00000001",
          stage: "ETR00000001",
          orderStatus: "en_proceso",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      { name: "solo desde", searchParams: { from: "2026-07-01" } },
    ],
  },
]);

// Hallazgo 6 de la 10.3a: el rango corta en el dia siguiente, no a las 23:59:59:
// timestamptz guarda microsegundos y un avance de las 23:59:59.5 quedaba fuera.
describe("rango de fechas de cuellos de botella", () => {
  async function dateCondition(searchParams: Record<string, string>) {
    const { calls } = await characterizePage(
      () => import("./page"),
      { name: "rango", searchParams },
      "/dashboard/production/bottlenecks",
    );
    const query = calls.filter(isPrismaCall).find((call) => call.prisma === "avance_orden.findMany");
    const conditions = (query?.args as { where: { AND: Record<string, unknown>[] } }).where.AND;

    return conditions.find((condition) => "fecha_inicio_etapa" in condition)?.fecha_inicio_etapa;
  }

  it("incluye todo el ultimo dia, hasta el comienzo del siguiente", async () => {
    expect(await dateCondition({ from: "2026-07-01", to: "2026-07-31" })).toEqual({
      gte: new Date("2026-07-01T00:00:00"),
      lt: new Date("2026-08-01T00:00:00"),
    });
  });

  it("una fecha que no es fecha no filtra", async () => {
    expect(await dateCondition({ from: "2026-13-45" })).toBeUndefined();
  });
});
