import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  definePageSuite,
  expectAuthorizesBeforePrisma,
  generatedRow,
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

// Caracterizacion de Rutas de fabricacion (entrega 4.7), escrita antes
// de mover sus consultas a modules/production/routes/queries.ts.

// Etapa sin maquina asignada: las opciones de maquina no agregan la actual.
const stageWithoutMachine = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("etapa_ruta", "findFirst", args),
  etapa_ruta_maquina: [],
});

// Ruta con ordenes asociadas: el producto queda protegido.
const routeWithOrders = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("ruta_fabricacion", "findUnique", args),
  _count: { orden_trabajo: 2 },
});

// Ruta cuyo producto ya no esta entre los activos que ofrece el selector.
const routeWithInactiveProduct = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("ruta_fabricacion", "findUnique", args),
  id_producto: "PRO00000099",
  producto: {
    id_producto: "PRO00000099",
    nombre_producto: "Producto dado de baja",
    categoria: "herramientas",
    unidad_medida: "unidad",
    estado: false,
  },
  _count: { orden_trabajo: 0 },
});

const inactiveRoute = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("ruta_fabricacion", "findUnique", args),
  estado: false,
  etapa_ruta: [],
});

const routeWithoutStages = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("ruta_fabricacion", "findUnique", args),
  etapa_ruta: [],
});

// Etapa con avances y un tiempo antiguo sin recapturar.
const stageWithHistory = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("etapa_ruta", "findFirst", args),
  etapa_ruta_maquina: [],
  tiempo_estimado_horas: 4,
  tiempo_operario_minutos_unidad: null,
  _count: { avance_orden: 3, tarea_operario: 1 },
});

definePageSuite([
  {
    route: "/dashboard/production/routes",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: { q: "corte", product: "PRO00000001", status: "active" },
      },
      { name: "inactivas", searchParams: { status: "inactive" } },
    ],
  },
  {
    route: "/dashboard/production/routes/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
  {
    route: "/dashboard/production/routes/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "RUT00000001" } },
      {
        name: "con ordenes asociadas",
        params: { id: "RUT00000001" },
        data: { "ruta_fabricacion.findUnique": routeWithOrders },
      },
      {
        name: "con el producto inactivo",
        params: { id: "RUT00000001" },
        data: { "ruta_fabricacion.findUnique": routeWithInactiveProduct },
      },
      {
        name: "inexistente",
        params: { id: "RUT99999999" },
        data: { "ruta_fabricacion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/routes/[id]/stages",
    load: () => import("./[id]/stages/page"),
    cases: [
      { name: "etapas", params: { id: "RUT00000001" } },
      {
        name: "ruta sin etapas",
        params: { id: "RUT00000001" },
        data: { "ruta_fabricacion.findUnique": routeWithoutStages },
      },
      {
        name: "filtros con maquina y activas",
        params: { id: "RUT00000001" },
        searchParams: { q: "soldadura", requiresMachine: "yes", status: "active" },
      },
      {
        name: "sin maquina e inactivas",
        params: { id: "RUT00000001" },
        searchParams: { requiresMachine: "no", status: "inactive" },
      },
      {
        name: "inexistente",
        params: { id: "RUT99999999" },
        data: { "ruta_fabricacion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/routes/[id]/stages/new",
    load: () => import("./[id]/stages/new/page"),
    cases: [
      { name: "nueva etapa", params: { id: "RUT00000001" } },
      {
        name: "ruta inactiva",
        params: { id: "RUT00000001" },
        data: { "ruta_fabricacion.findUnique": inactiveRoute },
      },
      {
        name: "inexistente",
        params: { id: "RUT99999999" },
        data: { "ruta_fabricacion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/routes/[id]/stages/[stageId]/edit",
    load: () => import("./[id]/stages/[stageId]/edit/page"),
    cases: [
      { name: "editar con maquina", params: { id: "RUT00000001", stageId: "ETR00000001" } },
      {
        name: "editar con avances y tiempo antiguo",
        params: { id: "RUT00000001", stageId: "ETR00000002" },
        data: { "etapa_ruta.findFirst": stageWithHistory },
      },
      {
        name: "editar sin maquina",
        params: { id: "RUT00000001", stageId: "ETR00000002" },
        data: { "etapa_ruta.findFirst": stageWithoutMachine },
      },
      {
        name: "inexistente",
        params: { id: "RUT00000001", stageId: "ETR99999999" },
        data: { "etapa_ruta.findFirst": null },
      },
    ],
  },
]);

// Entrega 10.6a: alta y edicion en panel lateral (rutas interceptadas desde el
// listado). Mismos permisos, misma consulta y mismo formulario que las paginas
// completas; la URL directa o la recarga no pasan por aqui.
const LIST_ROUTE = "/dashboard/production/routes";
const ROLES = ["ADMIN", "WORKSHOP_MASTER"];
const loadNew = () => import("./new/page");
const loadEdit = () => import("./[id]/edit/page");
const loadNewPanel = () => import("./@panel/(.)new/page");
const loadEditPanel = () => import("./@panel/(.)[id]/edit/page");

preloadPages(loadNewPanel, loadEditPanel);

function prismaCalls(calls: RecordedCall[]) {
  return calls.filter(isPrismaCall);
}

describe("panel lateral de rutas", () => {
  it("el alta en panel autoriza y consulta igual que la pagina y muestra el formulario en el panel", async () => {
    const panel = await characterizePage(loadNewPanel, { name: "panel nuevo" }, `${LIST_ROUTE}/new`);
    const page = await characterizePage(loadNew, { name: "nuevo" }, `${LIST_ROUTE}/new`);

    expectAuthorizesBeforePrisma(panel.calls);
    expect(panel.calls).toEqual(page.calls);
    expect(panel.html).toMatchSnapshot();
  });

  it("la edicion en panel hace la misma consulta que la pagina y muestra el formulario en el panel", async () => {
    const editCase = { name: "panel editar", params: { id: "RUT00000001" } };
    const panel = await characterizePage(loadEditPanel, editCase, `${LIST_ROUTE}/RUT00000001/edit`);
    const page = await characterizePage(loadEdit, editCase, `${LIST_ROUTE}/RUT00000001/edit`);

    expectAuthorizesBeforePrisma(panel.calls);
    expect(prismaCalls(panel.calls)).toEqual(prismaCalls(page.calls));
    expect(panel.html).toMatchSnapshot();
  });

  it("la edicion en panel responde notFound si la ruta no existe", async () => {
    const result = await characterizePage(
      loadEditPanel,
      { name: "panel inexistente", params: { id: "RUT99999999" }, data: { "ruta_fabricacion.findUnique": null } },
      `${LIST_ROUTE}/RUT99999999/edit`,
    );

    expect(result.outcome).toBe("notFound");
  });

  it.each([
    ["alta", loadNewPanel, {}],
    ["edicion", loadEditPanel, { params: { id: "RUT00000001" } }],
  ] as const)("un acceso rechazado al panel de %s no consulta Prisma", async (_name, load, extra) => {
    const calls = await runWithRejectedAuth(load, { name: "rechazo", ...extra }, LIST_ROUTE);

    expect(calls).toEqual([{ authz: "requireRole", roles: ROLES }]);
  });

  it("fuera del alta y la edicion interceptadas, la ranura del panel no muestra nada", async () => {
    const { default: PanelDefault } = await import("./@panel/default");
    const { default: PanelOnList } = await import("./@panel/page");

    expect(PanelDefault()).toBeNull();
    expect(PanelOnList()).toBeNull();
  });
});
