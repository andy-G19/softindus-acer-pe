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

// Caracterizacion de Mantenimientos preventivos (entrega 4.4), escrita antes
// de mover sus consultas a modules/maintenance/preventive/queries.ts.
// La 10.5b agrega un mantenimiento en cada estado guardado y dos pendientes:
// uno con fecha pasada, que la pagina muestra «Vencido» y preselecciona en su
// selector, y otro con fecha futura. El reloj del arnes esta fijo el
// 2026-07-15. Realizados y anulados muestran «Sin accion».

const PREVENTIVE_ROWS = [
  { estado: "pendiente", fecha_programada: "2026-07-20" },
  { estado: "pendiente", fecha_programada: "2026-07-10" },
  { estado: "vencido", fecha_programada: "2026-07-05" },
  { estado: "realizado", fecha_programada: "2026-07-01", fecha_realizada: "2026-07-02" },
  { estado: "anulado", fecha_programada: "2026-06-28" },
];

const maintenancesInEveryState = (args: PrismaArgs) => {
  const [first] = generatedResult("mantenimiento_preventivo", "findMany", args) as Record<string, unknown>[];

  return PREVENTIVE_ROWS.map((row, index) => ({
    ...first,
    id_mantenimiento: `MTP0000000${index + 1}`,
    actividad: `Mantenimiento ${row.estado} ${row.fecha_programada}`,
    estado: row.estado,
    fecha_programada: new Date(`${row.fecha_programada}T00:00:00.000Z`),
    fecha_realizada: row.fecha_realizada ? new Date(`${row.fecha_realizada}T00:00:00.000Z`) : null,
  }));
};

definePageSuite([
  {
    route: "/dashboard/maintenance/preventive",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "lubricacion",
          machine: "torno",
          responsible: "juan",
          status: "pendiente",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      {
        name: "un mantenimiento en cada estado",
        data: { "mantenimiento_preventivo.findMany": maintenancesInEveryState },
      },
    ],
  },
  {
    route: "/dashboard/maintenance/preventive/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      {
        name: "con regreso al listado filtrado",
        searchParams: { returnTo: "/dashboard/maintenance/preventive?status=vencido" },
      },
    ],
  },
]);

// Entrega 10.5b: alta en panel lateral (ruta interceptada desde el listado).
// Mismos permisos, misma consulta y mismo formulario que la pagina completa;
// la URL directa o la recarga no pasan por aqui.
const LIST_ROUTE = "/dashboard/maintenance/preventive";
const loadList = () => import("./page");
const loadNew = () => import("./new/page");
const loadNewPanel = () => import("./@panel/(.)new/page");

preloadPages(loadNewPanel);

describe("panel lateral de preventivos", () => {
  it("el alta en panel autoriza y consulta igual que la pagina", async () => {
    const panel = await characterizePage(loadNewPanel, { name: "panel nuevo" }, `${LIST_ROUTE}/new`);
    const page = await characterizePage(loadNew, { name: "nuevo" }, `${LIST_ROUTE}/new`);

    expectAuthorizesBeforePrisma(panel.calls);
    expect(panel.calls).toEqual(page.calls);
    expect(panel.html).toMatchSnapshot();
  });

  it("un acceso rechazado al panel no consulta Prisma", async () => {
    const calls = await runWithRejectedAuth(loadNewPanel, { name: "rechazo" }, LIST_ROUTE);

    expect(calls).toEqual([{ authz: "requireRole", roles: ["ADMIN"] }]);
  });

  it("fuera del alta interceptada, la ranura del panel no muestra nada", async () => {
    const { default: PanelDefault } = await import("./@panel/default");
    const { default: PanelOnList } = await import("./@panel/page");

    expect(PanelDefault()).toBeNull();
    expect(PanelOnList()).toBeNull();
  });

  it.each([
    ["pagina", loadNew],
    ["panel", loadNewPanel],
  ] as const)("sin maquinas, la %s enlaza Registrar maquina", async (_surface, load) => {
    const { html } = await characterizePage(
      load,
      { name: "sin maquinas", data: { "maquina.findMany": [] } },
      `${LIST_ROUTE}/new`,
    );

    expect(html).toContain("Primero registra una maquina para poder programar mantenimientos preventivos.");
    expect(html).toContain('href="/dashboard/maintenance/machines/new"');
  });
});

describe("lista de preventivos con filtros", () => {
  const filtered = {
    name: "filtrada",
    searchParams: { status: "vencido", from: "2026-07-01", to: "2026-07-31" },
  };

  it("el alta lleva el regreso al listado filtrado", async () => {
    const { html } = await characterizePage(loadList, filtered, LIST_ROUTE);
    const returnTo = encodeURIComponent(`${LIST_ROUTE}?status=vencido&from=2026-07-01&to=2026-07-31`);

    expect(html).toContain(`href="${LIST_ROUTE}/new?returnTo=${returnTo.replaceAll("&", "&amp;")}"`);
  });

  it("los filtros conservan sus nombres en la URL", async () => {
    const { html } = await characterizePage(loadList, filtered, LIST_ROUTE);

    for (const name of ["q", "machine", "responsible", "status", "from", "to"]) {
      expect(html).toContain(`name="${name}"`);
    }
  });

  it("no comparte ids con el formulario del panel", async () => {
    const list = await characterizePage(loadList, { name: "lista" }, LIST_ROUTE);
    const panel = await characterizePage(loadNewPanel, { name: "panel" }, `${LIST_ROUTE}/new`);
    const ids = (html: string | null) => [...(html ?? "").matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
    const inPanel = new Set(ids(panel.html ?? null));

    expect(ids(list.html ?? null).filter((id) => inPanel.has(id))).toEqual([]);
  });
});
