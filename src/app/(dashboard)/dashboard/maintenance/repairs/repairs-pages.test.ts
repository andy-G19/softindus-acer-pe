import { vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
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

// Caracterizacion de Reparaciones (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/repairs/queries.ts.
// La 10.5b agrega una reparacion en cada estado (ejecutadas y anuladas
// muestran «Sin accion») y, en la primera, el ejemplo del hallazgo 3 tal como
// lo guarda hoy la base: dos detalles de 12,81 y un costo total de 25,63, que
// la base redondeo por su cuenta desde 25,625. La lista suma los subtotales
// (25,62) y muestra el total guardado.

const REPAIR_STATES = ["programada", "ejecutada", "observada", "anulada"];

const repairsInEveryState = (args: PrismaArgs) => {
  const [first] = generatedResult("reparacion", "findMany", args) as Record<string, unknown>[];
  const [detail] = first.detalle_repuesto_reparacion as Record<string, unknown>[];
  const halfRoundedDetail = (id: string) => ({
    ...detail,
    id_detalle_repuesto: id,
    cantidad: new Prisma.Decimal("1.25"),
    costo_unitario: new Prisma.Decimal("10.25"),
    subtotal: new Prisma.Decimal("12.81"),
  });

  return REPAIR_STATES.map((estado_reparacion, index) => ({
    ...first,
    id_reparacion: `RPA0000000${index + 1}`,
    estado_reparacion,
    ...(index === 0
      ? {
          mano_obra: null,
          costo_total: new Prisma.Decimal("25.63"),
          detalle_repuesto_reparacion: [halfRoundedDetail("DRP00000001"), halfRoundedDetail("DRP00000002")],
        }
      : { detalle_repuesto_reparacion: [] }),
  }));
};

definePageSuite([
  {
    route: "/dashboard/maintenance/repairs",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "rodamiento",
          machine: "torno",
          failure: "FAL",
          status: "ejecutada",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      {
        name: "una reparacion en cada estado",
        data: { "reparacion.findMany": repairsInEveryState },
      },
    ],
  },
  {
    route: "/dashboard/maintenance/repairs/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
]);
