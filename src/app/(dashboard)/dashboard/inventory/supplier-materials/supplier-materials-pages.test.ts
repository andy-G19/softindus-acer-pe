import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  definePageSuite,
  expectAuthorizesBeforePrisma,
  isPrismaCall,
  preloadPages,
  runWithRejectedAuth,
  type RecordedCall,
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

// Caracterizacion de Proveedor-material (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/supplier-materials/queries.ts.

definePageSuite([
  {
    route: "/dashboard/inventory/supplier-materials",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          supplier: "PRV00000001",
          material: "MAT00000001",
          availability: "alta",
          status: "inactive",
        },
      },
      { name: "activos", searchParams: { status: "active" } },
    ],
  },
  {
    route: "/dashboard/inventory/supplier-materials/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      {
        name: "formulario con regreso al listado filtrado",
        searchParams: { returnTo: "/dashboard/inventory/supplier-materials?status=active" },
      },
    ],
  },
  {
    route: "/dashboard/inventory/supplier-materials/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "PVM00000001" } },
      {
        name: "editar con regreso al listado",
        params: { id: "PVM00000001" },
        searchParams: { returnTo: "/dashboard/inventory/supplier-materials?supplier=PRV00000001" },
      },
      {
        name: "inexistente",
        params: { id: "PVM99999999" },
        data: { "proveedor_material.findUnique": null },
      },
    ],
  },
]);

// Entrega 10.3b: la etiqueta del tiempo de entrega lleva tilde.
describe("textos del formulario de asociaciones", () => {
  it("la etiqueta del tiempo de entrega dice dias con tilde", async () => {
    const result = await characterizePage(() => import("./new/page"), { name: "nuevo" }, "/dashboard/inventory/supplier-materials/new");

    expect(result.html).toContain("Tiempo de entrega (días)");
  });
});

// Entrega 10.3b: alta y edicion en panel lateral (rutas interceptadas desde el
// listado). Mismos permisos, misma consulta y mismo formulario que las paginas
// completas; la URL directa o la recarga no pasan por aqui.
const LIST_ROUTE = "/dashboard/inventory/supplier-materials";
const loadNew = () => import("./new/page");
const loadEdit = () => import("./[id]/edit/page");
const loadNewPanel = () => import("./@panel/(.)new/page");
const loadEditPanel = () => import("./@panel/(.)[id]/edit/page");

preloadPages(loadNewPanel, loadEditPanel);

function prismaCalls(calls: RecordedCall[]) {
  return calls.filter(isPrismaCall);
}

describe("panel lateral de asociaciones proveedor-material", () => {
  it("el alta en panel autoriza y consulta igual que la pagina y muestra el formulario en el panel", async () => {
    const panel = await characterizePage(loadNewPanel, { name: "panel nuevo" }, `${LIST_ROUTE}/new`);
    const page = await characterizePage(loadNew, { name: "nuevo" }, `${LIST_ROUTE}/new`);

    expectAuthorizesBeforePrisma(panel.calls);
    expect(panel.calls).toEqual(page.calls);
    expect(panel.html).toMatchSnapshot();
  });

  it("la edicion en panel hace la misma consulta que la pagina y muestra el formulario en el panel", async () => {
    const editCase = { name: "panel editar", params: { id: "PVM00000001" } };
    const panel = await characterizePage(loadEditPanel, editCase, `${LIST_ROUTE}/PVM00000001/edit`);
    const page = await characterizePage(loadEdit, editCase, `${LIST_ROUTE}/PVM00000001/edit`);

    expectAuthorizesBeforePrisma(panel.calls);
    expect(prismaCalls(panel.calls)).toEqual(prismaCalls(page.calls));
    expect(panel.html).toMatchSnapshot();
  });

  it("la edicion en panel responde notFound si la asociacion no existe", async () => {
    const result = await characterizePage(
      loadEditPanel,
      { name: "panel inexistente", params: { id: "PVM99999999" }, data: { "proveedor_material.findUnique": null } },
      `${LIST_ROUTE}/PVM99999999/edit`,
    );

    expect(result.outcome).toBe("notFound");
  });

  it.each([
    ["alta", loadNewPanel, {}],
    ["edicion", loadEditPanel, { params: { id: "PVM00000001" } }],
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
