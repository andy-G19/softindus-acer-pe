import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { characterizePage, definePageSuite, generatedRow, isPrismaCall } from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
// RouteSheet pinta su contenido en un portal, que no existe en el render de
// servidor: el HTML de un panel sale vacio. El doble lo deja en linea para que la
// prueba vea el titulo, los avisos y el formulario del panel.
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

// Caracterizacion de Campanas de produccion (entrega 4.7), escrita antes
// de mover sus consultas a modules/production/campaigns/queries.ts.

// Campana sin detalles: la consulta de productos no excluye ninguno.
const campaignWithoutDetails = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("campania_produccion", "findUnique", args),
  campania_detalle: [],
});

// Una campana por estado: cada uno ofrece sus acciones de fila.
const campaignsIn =
  (...estados: string[]) =>
  (args: Parameters<typeof generatedRow>[2]) =>
    estados.map((estado, index) => ({
      ...generatedRow("campania_produccion", "findUnique", args),
      id_campania: `CAM0000000${index + 1}`,
      estado,
    }));

const campaignInState = (estado: string) => (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("campania_produccion", "findUnique", args),
  estado,
});

definePageSuite([
  {
    route: "/dashboard/production/campaigns",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "lote",
          product: "PRO00000001",
          status: "activa",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      { name: "solo hasta", searchParams: { to: "2026-07-31" } },
      {
        name: "acciones de cada estado",
        data: {
          "campania_produccion.findMany": campaignsIn("planificada", "activa", "finalizada", "anulada"),
        },
      },
      { name: "sin campanas", data: { "campania_produccion.findMany": [] } },
    ],
  },
  {
    route: "/dashboard/production/campaigns/[id]",
    load: () => import("./[id]/page"),
    cases: [
      { name: "detalle", params: { id: "CAM00000001" } },
      {
        name: "finalizada no ofrece agregar producto",
        params: { id: "CAM00000001" },
        data: { "campania_produccion.findUnique": campaignInState("finalizada") },
      },
      {
        name: "inexistente",
        params: { id: "CAM99999999" },
        data: { "campania_produccion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/campaigns/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "vuelve al returnTo", searchParams: { returnTo: "/dashboard/production/campaigns?status=activa" } },
      { name: "un returnTo ajeno vuelve a la lista", searchParams: { returnTo: "https://otro.example/x" } },
    ],
  },
  {
    route: "/dashboard/production/campaigns/@panel/(.)new",
    load: () => import("./@panel/(.)new/page"),
    cases: [{ name: "panel de alta" }],
  },
  {
    route: "/dashboard/production/campaigns/@panel/(.)[id]/edit",
    load: () => import("./@panel/(.)[id]/edit/page"),
    cases: [
      { name: "panel de edicion", params: { id: "CAM00000001" } },
      {
        name: "inexistente",
        params: { id: "CAM99999999" },
        data: { "campania_produccion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/campaigns/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "CAM00000001" } },
      {
        name: "anulada queda bloqueada",
        params: { id: "CAM00000001" },
        data: { "campania_produccion.findUnique": campaignInState("anulada") },
      },
      {
        name: "inexistente",
        params: { id: "CAM99999999" },
        data: { "campania_produccion.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/campaigns/[id]/details/new",
    load: () => import("./[id]/details/new/page"),
    cases: [
      { name: "excluye productos ya agregados", params: { id: "CAM00000001" } },
      {
        name: "campana sin detalles",
        params: { id: "CAM00000002" },
        data: { "campania_produccion.findUnique": campaignWithoutDetails },
      },
      {
        name: "inexistente",
        params: { id: "CAM99999999" },
        data: { "campania_produccion.findUnique": null },
      },
    ],
  },
]);

// A4 de la 10.7a: el rango de la lista es el de buildDateRangeFilter, como en los demas
// listados: el ultimo dia se incluye con lt el dia siguiente, no con lte a las 23:59:59.
// D2 de la 10.7: el alta ofrece dos estados y la edicion ninguno.
describe("estado en los formularios de campana", () => {
  it("el alta solo ofrece Planificada y Activa", async () => {
    const { html } = await characterizePage(
      () => import("./new/page"),
      { name: "alta" },
      "/dashboard/production/campaigns/new",
    );

    expect(html).toContain('value="planificada"');
    expect(html).toContain('value="activa"');
    expect(html).not.toContain('value="finalizada"');
    expect(html).not.toContain('value="anulada"');
  });

  it("la edicion no tiene campo de estado", async () => {
    const { html } = await characterizePage(
      () => import("./[id]/edit/page"),
      { name: "edicion", params: { id: "CAM00000001" } },
      "/dashboard/production/campaigns/CAM00000001/edit",
    );

    expect(html).toContain('name="nombre_campania"');
    expect(html).not.toContain('name="estado"');
  });
});

describe("rango de fechas de la lista de campanas", () => {
  async function dateCondition(searchParams: Record<string, string>) {
    const { calls } = await characterizePage(
      () => import("./page"),
      { name: "rango", searchParams },
      "/dashboard/production/campaigns",
    );
    const list = calls.filter(isPrismaCall).find((call) => call.prisma === "campania_produccion.findMany");
    const where = (list?.args as { where: { AND?: { fecha_inicio?: unknown }[] } }).where;

    return where.AND?.find((condition) => condition.fecha_inicio)?.fecha_inicio;
  }

  it("desde y hasta incluyen el ultimo dia con lt el dia siguiente", async () => {
    expect(await dateCondition({ from: "2026-07-01", to: "2026-07-31" })).toEqual({
      gte: new Date("2026-07-01T00:00:00"),
      lt: new Date("2026-08-01T00:00:00"),
    });
  });

  it("solo hasta no tiene limite inferior", async () => {
    expect(await dateCondition({ to: "2026-07-31" })).toEqual({ lt: new Date("2026-08-01T00:00:00") });
  });

  it("solo desde no tiene limite superior", async () => {
    expect(await dateCondition({ from: "2026-07-01" })).toEqual({ gte: new Date("2026-07-01T00:00:00") });
  });

  it("sin fechas no filtra", async () => {
    expect(await dateCondition({})).toBeUndefined();
  });

  it("una fecha que no se entiende no filtra", async () => {
    expect(await dateCondition({ from: "no-es-fecha" })).toBeUndefined();
  });
});
