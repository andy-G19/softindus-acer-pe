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

// Caracterizacion de Fallas (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/failures/queries.ts.
// La 10.5b agrega una falla en cada estado, con ADMIN y con el maestro de
// taller, y el alta con el maestro de taller: los datos generados no pintan
// estados reales. Hoy el selector y «Guardar» aparecen tambien en las fallas
// reparadas y anuladas (hallazgo 8 de la auditoria de la 10.5). Dos reparadas
// para que cada indicador cuente un numero distinto.

const FAILURE_STATES = ["pendiente", "en_atencion", "reparada", "anulada", "reparada"];

const failuresInEveryState = (args: PrismaArgs) => {
  const [first] = generatedResult("falla_maquina", "findMany", args) as Record<string, unknown>[];

  return FAILURE_STATES.map((estado_atencion, index) => ({
    ...first,
    id_falla: `FAL0000000${index + 1}`,
    descripcion: `Falla ${estado_atencion}`,
    estado_atencion,
  }));
};

definePageSuite([
  {
    route: "/dashboard/maintenance/failures",
    load: () => import("./page"),
    cases: [
      { name: "administrador" },
      { name: "maestro de taller", role: "WORKSHOP_MASTER" },
      {
        name: "una falla en cada estado",
        data: { "falla_maquina.findMany": failuresInEveryState },
      },
      {
        name: "una falla en cada estado con el maestro de taller",
        role: "WORKSHOP_MASTER",
        data: { "falla_maquina.findMany": failuresInEveryState },
      },
    ],
  },
  {
    route: "/dashboard/maintenance/failures/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "formulario con el maestro de taller", role: "WORKSHOP_MASTER" },
    ],
  },
]);
