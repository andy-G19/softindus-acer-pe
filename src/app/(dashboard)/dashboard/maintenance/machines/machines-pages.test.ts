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
      {
        name: "con regreso al listado filtrado",
        searchParams: { returnTo: "/dashboard/maintenance/machines?type=prensa" },
      },
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

// Entrega 10.5a: alta y edicion en panel lateral (rutas interceptadas desde el
// listado). Mismos permisos, misma consulta y mismo formulario que las paginas
// completas; la URL directa o la recarga no pasan por aqui.
const LIST_ROUTE = "/dashboard/maintenance/machines";
const loadNew = () => import("./new/page");
const loadEdit = () => import("./[id]/edit/page");
const loadNewPanel = () => import("./@panel/(.)new/page");
const loadEditPanel = () => import("./@panel/(.)[id]/edit/page");

preloadPages(loadNewPanel, loadEditPanel);

describe("panel lateral de maquinas", () => {
  it("el alta en panel autoriza igual que la pagina, sin consultar, y muestra el formulario en el panel", async () => {
    const panel = await characterizePage(loadNewPanel, { name: "panel nuevo" }, `${LIST_ROUTE}/new`);
    const page = await characterizePage(loadNew, { name: "nuevo" }, `${LIST_ROUTE}/new`);

    expect(panel.calls).toEqual(page.calls);
    expect(panel.calls).toEqual([{ authz: "requireRole", roles: ["ADMIN"] }]);
    expect(panel.html).toMatchSnapshot();
  });

  it("la edicion en panel hace la misma consulta que la pagina y muestra el formulario en el panel", async () => {
    const editCase = {
      name: "panel editar",
      params: { id: "MAQ00000001" },
      searchParams: { returnTo: "/dashboard/maintenance/machines?status=operativa" },
    };
    const panel = await characterizePage(loadEditPanel, editCase, `${LIST_ROUTE}/MAQ00000001/edit`);
    const page = await characterizePage(loadEdit, editCase, `${LIST_ROUTE}/MAQ00000001/edit`);

    expectAuthorizesBeforePrisma(panel.calls);
    expect(panel.calls).toEqual(page.calls);
    expect(panel.html).toMatchSnapshot();
  });

  it("la edicion en panel responde notFound si la maquina no existe", async () => {
    const result = await characterizePage(
      loadEditPanel,
      { name: "panel inexistente", params: { id: "MAQ99999999" }, data: { "maquina.findUnique": null } },
      `${LIST_ROUTE}/MAQ99999999/edit`,
    );

    expect(result.outcome).toBe("notFound");
  });

  it.each([
    ["alta", loadNewPanel, {}],
    ["edicion", loadEditPanel, { params: { id: "MAQ00000001" } }],
  ] as const)("un acceso rechazado al panel de %s no consulta Prisma", async (_name, load, extra) => {
    const calls = await runWithRejectedAuth(load, { name: "rechazo", ...extra }, LIST_ROUTE);

    expect(calls).toEqual([{ authz: "requireRole", roles: ["ADMIN"] }]);
  });

  it("fuera del alta y la edicion interceptadas, la ranura del panel no muestra nada", async () => {
    const { default: PanelDefault } = await import("./@panel/default");
    const { default: PanelOnList } = await import("./@panel/page");

    expect(PanelDefault()).toBeNull();
    expect(PanelOnList()).toBeNull();
  });
});
