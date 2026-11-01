import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  definePageSuite,
  expectAuthorizesBeforePrisma,
  generatedResult,
  preloadPages,
  runWithRejectedAuth,
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

// Radix no renderiza portales en el servidor: para ver el panel lateral en el
// HTML, el portal del Dialog (Sheet) pasa directo. Las paginas completas no
// usan Dialog.
vi.mock("radix-ui", async (importOriginal) => {
  const radix = await importOriginal<typeof import("radix-ui")>();
  const { createElement, Fragment } = await import("react");

  return {
    ...radix,
    Dialog: {
      ...radix.Dialog,
      Portal: ({ children }: { children?: unknown }) => createElement(Fragment, null, children as never),
    },
  };
});

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
      {
        name: "con regreso al listado",
        searchParams: { returnTo: "/dashboard/maintenance/failures?orden=fecha" },
      },
    ],
  },
]);

// Entrega 10.5b: alta en panel lateral (ruta interceptada desde el listado).
// Mismos permisos (ADMIN y maestro de taller), misma consulta y mismo
// formulario que la pagina completa; la URL directa o la recarga no pasan por
// aqui.
const LIST_ROUTE = "/dashboard/maintenance/failures";
const loadNew = () => import("./new/page");
const loadNewPanel = () => import("./@panel/(.)new/page");

preloadPages(loadNewPanel);

describe("panel lateral de fallas", () => {
  it.each(["ADMIN", "WORKSHOP_MASTER"] as const)(
    "con %s el alta en panel autoriza y consulta igual que la pagina",
    async (role) => {
      const panel = await characterizePage(loadNewPanel, { name: "panel nuevo", role }, `${LIST_ROUTE}/new`);
      const page = await characterizePage(loadNew, { name: "nuevo", role }, `${LIST_ROUTE}/new`);

      expectAuthorizesBeforePrisma(panel.calls);
      expect(panel.calls).toEqual(page.calls);
      expect(panel.html).toContain("Registrar falla");
    },
  );

  it("muestra el formulario en el panel", async () => {
    const panel = await characterizePage(loadNewPanel, { name: "panel nuevo" }, `${LIST_ROUTE}/new`);

    expect(panel.html).toMatchSnapshot();
  });

  it("un acceso rechazado al panel no consulta Prisma", async () => {
    const calls = await runWithRejectedAuth(loadNewPanel, { name: "rechazo" }, LIST_ROUTE);

    expect(calls).toEqual([{ authz: "requireRole", roles: ["ADMIN", "WORKSHOP_MASTER"] }]);
  });

  it("fuera del alta interceptada, la ranura del panel no muestra nada", async () => {
    const { default: PanelDefault } = await import("./@panel/default");
    const { default: PanelOnList } = await import("./@panel/page");

    expect(PanelDefault()).toBeNull();
    expect(PanelOnList()).toBeNull();
  });
});

// Registrar una maquina es solo de ADMIN: sin maquinas, el maestro de taller no
// ve el enlace que lo llevaria a «acceso denegado» (10.5b).
describe("alta de falla sin maquinas", () => {
  const noMachines = { "maquina.findMany": [] };

  it.each([
    ["pagina", "ADMIN", loadNew, true],
    ["pagina", "WORKSHOP_MASTER", loadNew, false],
    ["panel", "ADMIN", loadNewPanel, true],
    ["panel", "WORKSHOP_MASTER", loadNewPanel, false],
  ] as const)("%s con %s", async (_surface, role, load, linked) => {
    const { html } = await characterizePage(load, { name: "sin maquinas", role, data: noMachines }, `${LIST_ROUTE}/new`);

    expect(html).toContain("No hay maquinas registradas.");
    expect(html?.includes('href="/dashboard/maintenance/machines/new"')).toBe(linked);
  });
});
