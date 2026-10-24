import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  definePageSuite,
  expectAuthorizesBeforePrisma,
  generatedResult,
  generatedRow,
  isPrismaCall,
  preloadPages,
  runWithRejectedAuth,
  type PrismaArgs,
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

// Caracterizacion de Productos (entrega 4.2), escrita antes de mover sus
// consultas a modules/commercial/products/queries.ts.
//
// Entrega 10.4a: casos que los datos generados nunca pintan, antes de llevar
// el formulario al panel lateral y la barra a FilterBar: la lista vacia, los
// filtros que coinciden con sus opciones (elegidas en la barra), el alta sin
// categorias activas y la edicion con su categoria y su unidad elegidas (la
// categoria actual se ofrece aunque este inactiva).

const CATEGORIES = [
  { nombre: "Estructuras metálicas", slug: "estructuras" },
  { nombre: "Herramientas agrícolas", slug: "herramientas" },
];

// La lista y las unidades salen de producto.findMany: las unidades piden
// distinct.
const productsWithUnits = (args: PrismaArgs) =>
  args?.distinct
    ? [{ unidad_medida: "docena" }, { unidad_medida: "unidad" }]
    : generatedResult("producto", "findMany", args);

const productToEdit = (args: PrismaArgs) => ({
  ...generatedRow("producto", "findUnique", args),
  categoria: "herramientas",
  unidad_medida: "docena",
  precio_referencial: "35.5",
  descripcion: "Mango de eucalipto.",
});

definePageSuite([
  {
    route: "/dashboard/commercial/products",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "filtros y vendedor",
        role: "SELLER",
        searchParams: {
          q: "reja",
          category: "estructuras",
          unit: "unidad",
          status: "active",
          page: "2",
        },
      },
      { name: "inactivos", searchParams: { status: "inactive" } },
      { name: "estado desconocido", searchParams: { status: "todos" } },
      {
        name: "sin productos registrados",
        data: { "producto.findMany": [], "producto.count": 0 },
      },
      {
        name: "filtros que coinciden con sus opciones",
        searchParams: { q: "lampa", category: "herramientas", unit: "docena", status: "inactive" },
        data: { "categoria_producto.findMany": CATEGORIES, "producto.findMany": productsWithUnits },
      },
    ],
  },
  {
    route: "/dashboard/commercial/products/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "sin categorias activas", data: { "categoria_producto.findMany": [] } },
      {
        name: "formulario con regreso al listado filtrado",
        searchParams: { returnTo: "/dashboard/commercial/products?status=inactive" },
      },
    ],
  },
  {
    route: "/dashboard/commercial/products/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "PRO00000001" } },
      {
        name: "editar con regreso al listado",
        params: { id: "PRO00000001" },
        searchParams: { returnTo: "/dashboard/commercial/products?q=lampa" },
      },
      {
        name: "con su categoria y su unidad elegidas",
        params: { id: "PRO00000004" },
        data: { "producto.findUnique": productToEdit, "categoria_producto.findMany": CATEGORIES },
      },
      {
        name: "inexistente",
        params: { id: "PRO99999999" },
        data: { "producto.findUnique": null },
      },
    ],
  },
]);

// Entrega 10.4a: alta y edicion en panel lateral (rutas interceptadas desde el
// listado). Mismos permisos, misma consulta y mismo formulario que las paginas
// completas; la URL directa o la recarga no pasan por aqui.
const LIST_ROUTE = "/dashboard/commercial/products";
const loadNew = () => import("./new/page");
const loadEdit = () => import("./[id]/edit/page");
const loadNewPanel = () => import("./@panel/(.)new/page");
const loadEditPanel = () => import("./@panel/(.)[id]/edit/page");

preloadPages(loadNewPanel, loadEditPanel);

function prismaCalls(calls: RecordedCall[]) {
  return calls.filter(isPrismaCall);
}

describe("panel lateral de productos", () => {
  it("el alta en panel autoriza y consulta igual que la pagina y muestra el formulario en el panel", async () => {
    const panel = await characterizePage(loadNewPanel, { name: "panel nuevo" }, `${LIST_ROUTE}/new`);
    const page = await characterizePage(loadNew, { name: "nuevo" }, `${LIST_ROUTE}/new`);

    expectAuthorizesBeforePrisma(panel.calls);
    expect(panel.calls).toEqual(page.calls);
    expect(panel.html).toMatchSnapshot();
  });

  it("la edicion en panel hace la misma consulta que la pagina y muestra el formulario en el panel", async () => {
    const editCase = {
      name: "panel editar",
      params: { id: "PRO00000004" },
      data: { "producto.findUnique": productToEdit, "categoria_producto.findMany": CATEGORIES },
    };
    const panel = await characterizePage(loadEditPanel, editCase, `${LIST_ROUTE}/PRO00000004/edit`);
    const page = await characterizePage(loadEdit, editCase, `${LIST_ROUTE}/PRO00000004/edit`);

    expectAuthorizesBeforePrisma(panel.calls);
    expect(prismaCalls(panel.calls)).toEqual(prismaCalls(page.calls));
    expect(panel.html).toMatchSnapshot();
  });

  it("la edicion en panel responde notFound si el producto no existe", async () => {
    const result = await characterizePage(
      loadEditPanel,
      { name: "panel inexistente", params: { id: "PRO99999999" }, data: { "producto.findUnique": null } },
      `${LIST_ROUTE}/PRO99999999/edit`,
    );

    expect(result.outcome).toBe("notFound");
  });

  it.each([
    ["alta", loadNewPanel, {}],
    ["edicion", loadEditPanel, { params: { id: "PRO00000004" } }],
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
