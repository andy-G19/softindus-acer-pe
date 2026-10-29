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

// Caracterizacion de Maquinas (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/machines/queries.ts.
// La 10.5a agrega el alta y una maquina en cada estado: los datos generados
// solo pintan uno.

const MACHINE_STATES = ["operativa", "en_reparacion", "dada_de_baja", "inactiva"];

// La lista, los tipos y las ubicaciones salen de maquina.findMany: los tipos
// y las ubicaciones piden distinct.
const machinesInEveryState = (args: PrismaArgs) => {
  if (args?.distinct) {
    return generatedResult("maquina", "findMany", args);
  }

  const [first, second] = generatedResult("maquina", "findMany", args) as Record<string, unknown>[];

  return MACHINE_STATES.map((estado, index) => ({
    ...(index % 2 === 0 ? first : second),
    id_maquina: `MAQ0000000${index + 1}`,
    nombre: `Maquina ${estado}`,
    estado,
  }));
};

definePageSuite([
  {
    route: "/dashboard/maintenance/machines",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "filtros y maestro de taller",
        role: "WORKSHOP_MASTER",
        searchParams: {
          q: "torno",
          type: "torno",
          location: "nave 1",
          status: "operativa",
        },
      },
      {
        name: "una maquina en cada estado",
        data: { "maquina.findMany": machinesInEveryState },
      },
    ],
  },
  {
    route: "/dashboard/maintenance/machines/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
  {
    route: "/dashboard/maintenance/machines/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      {
        name: "editar con regreso al listado",
        params: { id: "MAQ00000001" },
        searchParams: { returnTo: "/dashboard/maintenance/machines?status=operativa" },
      },
      {
        name: "inexistente",
        params: { id: "MAQ99999999" },
        data: { "maquina.findUnique": null },
      },
    ],
  },
]);
