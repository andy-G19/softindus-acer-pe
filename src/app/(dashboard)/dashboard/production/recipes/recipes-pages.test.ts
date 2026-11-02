import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  definePageSuite,
  expectAuthorizesBeforePrisma,
  generatedRow,
  preloadPages,
  runWithRejectedAuth,
  type DataOverride,
} from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
// RouteSheet pinta su contenido en un portal, que no existe en el render de
// servidor: el HTML de un panel sale vacio. El doble lo deja en linea para que la
// prueba vea el titulo y el formulario del panel.
vi.mock("@/components/navigation/route-sheet", () => ({
  RouteSheet: ({ title, description, children }: { title: string; description?: string; children: ReactNode }) =>
    createElement("section", null, createElement("h2", null, title), createElement("p", null, description), children),
}));
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

// Caracterizacion de Recetas tecnicas (entrega 4.7), escrita antes
// de mover sus consultas a modules/production/recipes/queries.ts. Los casos de
// estado (receta inactiva, version reemplazada o usada, material inactivo) se
// agregaron en la 10.6b, antes de migrar sus pantallas.

type Row = Record<string, unknown>;

// La fila generada para la consulta real, con los campos que el caso cambia.
function versionWith(method: "findFirst" | "findUnique", change: (version: Row) => Row): DataOverride {
  return (args) => change(generatedRow("version_receta", method, args) as Row);
}

const inactiveRecipe = (version: Row) => ({
  ...version,
  receta_tecnica: { ...(version.receta_tecnica as Row), estado: "inactiva" },
});

const usedVersion = (version: Row) => ({ ...version, _count: { ...(version._count as Row), orden_trabajo: 2 } });

// El arnes genera contadores altos: sin ordenes la version es editable.
const editableVersion = (version: Row) => ({
  ...version,
  estado: "vigente",
  receta_tecnica: { ...(version.receta_tecnica as Row), estado: "activa" },
  _count: { ...(version._count as Row), orden_trabajo: 0 },
});

const replacedVersion = (version: Row) => ({ ...version, estado: "reemplazada" });

const withUnit = (version: Row) => ({
  ...version,
  detalle_receta: (version.detalle_receta as Row[]).map((detail) => ({
    ...detail,
    unidad_medida: "gl",
    material: { ...(detail.material as Row), unidad_medida: "kg" },
  })),
});

// 0.3 - 0.1 da 0.19999999999999998 en coma flotante.
const justEnoughStock = (version: Row) => ({
  ...version,
  detalle_receta: (version.detalle_receta as Row[]).map((detail) => ({
    ...detail,
    cantidad_requerida: "0.2",
    merma_estimada_porcentaje: "0",
    material: { ...(detail.material as Row), stock_actual: "0.3", stock_reservado: "0.1" },
  })),
});

const recipeInVersions = (estado: string, versiones: Row[]): DataOverride => (args) => ({
  ...(generatedRow("receta_tecnica", "findUnique", args) as Row),
  estado,
  version_receta: versiones,
});

const historyRow = (args: Row, id: string, estado: string, orders: number) => ({
  ...args,
  id_version_receta: id,
  numero_version: id.slice(-2),
  estado,
  _count: { detalle_receta: 0, orden_trabajo: orders },
  detalle_receta: [],
  usuario: null,
});

const fullHistory = (versionBase: Row) => [
  historyRow(versionBase, "VER00000014", "vigente", 0),
  historyRow(versionBase, "VER00000013", "reemplazada", 0),
  historyRow(versionBase, "VER00000012", "reemplazada", 3),
  historyRow(versionBase, "VER00000011", "anulada", 0),
];

const versionBase: Row = {
  id_receta: "REC00000001",
  fecha_version: new Date("2026-07-01T00:00:00.000Z"),
  motivo_cambio: null,
};

definePageSuite([
  {
    route: "/dashboard/production/recipes",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: { q: "reja", product: "PRO00000001", status: "activa" },
      },
      { name: "sin recetas", data: { "receta_tecnica.findMany": [] } },
    ],
  },
  {
    route: "/dashboard/production/recipes/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "sin productos activos", data: { "producto.findMany": [] } },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions",
    load: () => import("./[id]/versions/page"),
    cases: [
      { name: "versiones", params: { id: "REC00000001" } },
      {
        name: "historial con cada estado",
        params: { id: "REC00000001" },
        data: { "receta_tecnica.findUnique": recipeInVersions("activa", fullHistory(versionBase)) },
      },
      {
        name: "receta inactiva con historial",
        params: { id: "REC00000001" },
        data: { "receta_tecnica.findUnique": recipeInVersions("inactiva", fullHistory(versionBase)) },
      },
      {
        name: "sin versiones",
        params: { id: "REC00000001" },
        data: { "receta_tecnica.findUnique": recipeInVersions("activa", []) },
      },
      {
        name: "inexistente",
        params: { id: "REC99999999" },
        data: { "receta_tecnica.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions/new",
    load: () => import("./[id]/versions/new/page"),
    cases: [
      { name: "nueva version", params: { id: "REC00000001" } },
      {
        name: "receta inactiva",
        params: { id: "REC00000001" },
        data: { "receta_tecnica.findUnique": recipeInVersions("inactiva", []) },
      },
      {
        name: "sin materiales activos",
        params: { id: "REC00000001" },
        data: { "material.findMany": [] },
      },
      {
        name: "inexistente",
        params: { id: "REC99999999" },
        data: { "receta_tecnica.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions/[versionId]/details",
    load: () => import("./[id]/versions/[versionId]/details/page"),
    cases: [
      { name: "detalle de version", params: { id: "REC00000001", versionId: "VER00000001" } },
      {
        name: "version editable",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "version_receta.findFirst": versionWith("findFirst", editableVersion) },
      },
      {
        name: "version vigente de una receta inactiva",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "version_receta.findFirst": versionWith("findFirst", (version) => inactiveRecipe(editableVersion(version))) },
      },
      {
        name: "version usada por ordenes",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "version_receta.findFirst": versionWith("findFirst", (version) => usedVersion(editableVersion(version))) },
      },
      {
        name: "version reemplazada",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "version_receta.findFirst": versionWith("findFirst", replacedVersion) },
      },
      {
        name: "unidad distinta a la del material",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "version_receta.findFirst": versionWith("findFirst", (version) => withUnit(editableVersion(version))) },
      },
      {
        name: "inexistente",
        params: { id: "REC00000001", versionId: "VER99999999" },
        data: { "version_receta.findFirst": null },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions/[versionId]/details/new",
    load: () => import("./[id]/versions/[versionId]/details/new/page"),
    cases: [
      { name: "nuevo detalle", params: { id: "REC00000001", versionId: "VER00000001" } },
      {
        name: "version editable",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "version_receta.findFirst": versionWith("findFirst", editableVersion) },
      },
      {
        name: "receta inactiva",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "version_receta.findFirst": versionWith("findFirst", (version) => inactiveRecipe(editableVersion(version))) },
      },
      {
        name: "version usada por ordenes",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "version_receta.findFirst": versionWith("findFirst", (version) => usedVersion(editableVersion(version))) },
      },
      {
        name: "sin materiales disponibles",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "material.findMany": [] },
      },
      {
        name: "inexistente",
        params: { id: "REC00000001", versionId: "VER99999999" },
        data: { "version_receta.findFirst": null },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions/[versionId]/details/[detailId]/edit",
    load: () => import("./[id]/versions/[versionId]/details/[detailId]/edit/page"),
    cases: [
      {
        name: "editar detalle de la receta",
        params: { id: "id_receta-1", versionId: "VER00000001", detailId: "DRE00000001" },
      },
      {
        name: "detalle de otra receta",
        params: { id: "REC00000002", versionId: "VER00000001", detailId: "DRE00000001" },
      },
      {
        name: "inexistente",
        params: { id: "id_receta-1", versionId: "VER00000001", detailId: "DRE99999999" },
        data: { "detalle_receta.findFirst": null },
      },
    ],
  },
  {
    route: "/dashboard/production/recipes/[id]/versions/[versionId]/requirements",
    load: () => import("./[id]/versions/[versionId]/requirements/page"),
    cases: [
      { name: "una unidad", params: { id: "REC00000001", versionId: "VER00000001" } },
      {
        name: "cantidad elegida",
        params: { id: "REC00000001", versionId: "VER00000001" },
        searchParams: { quantity: "25" },
      },
      {
        name: "cantidad invalida",
        params: { id: "REC00000001", versionId: "VER00000001" },
        searchParams: { quantity: "abc" },
      },
      {
        name: "stock que alcanza justo",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "version_receta.findFirst": versionWith("findFirst", justEnoughStock) },
      },
      {
        name: "version reemplazada de una receta inactiva",
        params: { id: "REC00000001", versionId: "VER00000001" },
        data: { "version_receta.findFirst": versionWith("findFirst", (version) => inactiveRecipe(replacedVersion(version))) },
      },
      {
        name: "inexistente",
        params: { id: "REC00000001", versionId: "VER99999999" },
        data: { "version_receta.findFirst": null },
      },
    ],
  },
]);

// B3 (hallazgo 5 de la auditoria de la 10.6): 0.3 - 0.1 da 0.19999999999999998, y
// sin redondear marcaba «Insuficiente» con un faltante de 0.00.
describe("el stock disponible de los requerimientos", () => {
  it("un stock que alcanza justo no se marca insuficiente", async () => {
    const { html } = await characterizePage(() => import("./[id]/versions/[versionId]/requirements/page"), {
      name: "stock que alcanza justo",
      params: { id: "REC00000001", versionId: "VER00000001" },
      data: { "version_receta.findFirst": versionWith("findFirst", justEnoughStock) },
    });

    expect(html).toContain("Suficiente");
    expect(html).not.toContain("Insuficiente");
  });
});

// B4: el alta de receta en panel lateral, interceptada desde el listado. Mismos
// permisos, misma consulta y mismo formulario que la pagina completa; la URL
// directa o la recarga no pasan por aqui.
const LIST_ROUTE = "/dashboard/production/recipes";
const loadNew = () => import("./new/page");
const loadNewPanel = () => import("./@panel/(.)new/page");

preloadPages(loadNewPanel);

describe("panel lateral de recetas", () => {
  it("el alta en panel autoriza y consulta igual que la pagina y muestra el formulario", async () => {
    const panel = await characterizePage(loadNewPanel, { name: "panel nuevo" }, `${LIST_ROUTE}/new`);
    const page = await characterizePage(loadNew, { name: "nuevo" }, `${LIST_ROUTE}/new`);

    expectAuthorizesBeforePrisma(panel.calls);
    expect(panel.calls).toEqual(page.calls);
    expect(panel.html).toContain("Nueva receta técnica");
    expect(panel.html).toContain("Nombre de la receta");
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

describe("la lista de recetas", () => {
  it("Nueva receta conserva los filtros en el returnTo", async () => {
    const { html } = await characterizePage(() => import("./page"), {
      name: "con filtros",
      searchParams: { q: "reja", status: "activa" },
    });

    expect(html).toContain(`${LIST_ROUTE}/new?returnTo=`);
    expect(html).toContain("q%3Dreja");
  });

  it.each([
    ["la lista", () => import("./page")],
    ["la pagina de alta", () => import("./new/page")],
  ])("%s no abre otro main dentro del shell", async (_name, load) => {
    const { html } = await characterizePage(load, { name: "sin main" });

    expect(html).not.toContain("<main");
  });

  it("la pagina de alta valida el returnTo", async () => {
    const { html } = await characterizePage(() => import("./new/page"), {
      name: "returnTo ajeno",
      searchParams: { returnTo: "https://evil.example" },
    });

    expect(html).not.toContain("evil.example");
  });
});
