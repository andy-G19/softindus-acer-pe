import { describe, expect, it, vi } from "vitest";

import {
  AuthRejected,
  characterizePage,
  generatedRow,
  preloadPages,
  type DataOverrides,
  type PageLoader,
  type Role,
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

// Entrega 10.6a: las pantallas de Produccion solo enlazan pantallas que el rol
// puede abrir. Las que migra esta sub-entrega ganaron paneles y enlaces con
// returnTo; la prueba abre cada enlace con el mismo rol: si el requireRole de la
// pantalla lo rechaza, falla aqui, asi que los enlaces no pueden quedar desfasados
// de las paginas. La 10.6b suma Recetas, con sus versiones, materiales y requerimientos,
// y la 10.7a, Campanas con su detalle.

// Pantalla de cada enlace, por su ruta sin la consulta; gana la primera que
// coincide. Los grupos con nombre son los parametros de la ruta. Un enlace sin
// fila en esta tabla hace fallar la prueba.
const PAGES: [RegExp, PageLoader][] = [
  [/^\/dashboard\/production$/, () => import("./page")],
  [/^\/dashboard\/production\/routes$/, () => import("./routes/page")],
  [/^\/dashboard\/production\/routes\/new$/, () => import("./routes/new/page")],
  [/^\/dashboard\/production\/routes\/(?<id>[^/]+)\/edit$/, () => import("./routes/[id]/edit/page")],
  [/^\/dashboard\/production\/routes\/(?<id>[^/]+)\/stages$/, () => import("./routes/[id]/stages/page")],
  [/^\/dashboard\/production\/routes\/(?<id>[^/]+)\/stages\/new$/, () => import("./routes/[id]/stages/new/page")],
  [
    /^\/dashboard\/production\/routes\/(?<id>[^/]+)\/stages\/(?<stageId>[^/]+)\/edit$/,
    () => import("./routes/[id]/stages/[stageId]/edit/page"),
  ],
  [/^\/dashboard\/production\/recipes$/, () => import("./recipes/page")],
  [/^\/dashboard\/production\/recipes\/new$/, () => import("./recipes/new/page")],
  [/^\/dashboard\/production\/recipes\/(?<id>[^/]+)\/versions$/, () => import("./recipes/[id]/versions/page")],
  [/^\/dashboard\/production\/recipes\/(?<id>[^/]+)\/versions\/new$/, () => import("./recipes/[id]/versions/new/page")],
  [
    /^\/dashboard\/production\/recipes\/(?<id>[^/]+)\/versions\/(?<versionId>[^/]+)\/details$/,
    () => import("./recipes/[id]/versions/[versionId]/details/page"),
  ],
  [
    /^\/dashboard\/production\/recipes\/(?<id>[^/]+)\/versions\/(?<versionId>[^/]+)\/details\/new$/,
    () => import("./recipes/[id]/versions/[versionId]/details/new/page"),
  ],
  [
    /^\/dashboard\/production\/recipes\/(?<id>[^/]+)\/versions\/(?<versionId>[^/]+)\/details\/(?<detailId>[^/]+)\/edit$/,
    () => import("./recipes/[id]/versions/[versionId]/details/[detailId]/edit/page"),
  ],
  [
    /^\/dashboard\/production\/recipes\/(?<id>[^/]+)\/versions\/(?<versionId>[^/]+)\/requirements$/,
    () => import("./recipes/[id]/versions/[versionId]/requirements/page"),
  ],
  [/^\/dashboard\/production\/campaigns$/, () => import("./campaigns/page")],
  [/^\/dashboard\/production\/campaigns\/new$/, () => import("./campaigns/new/page")],
  [/^\/dashboard\/production\/campaigns\/(?<id>[^/]+)$/, () => import("./campaigns/[id]/page")],
  [/^\/dashboard\/production\/campaigns\/(?<id>[^/]+)\/edit$/, () => import("./campaigns/[id]/edit/page")],
  [/^\/dashboard\/production\/bottlenecks$/, () => import("./bottlenecks/page")],
  [/^\/dashboard\/production\/work-orders$/, () => import("./work-orders/page")],
  [/^\/dashboard\/production\/work-orders\/new$/, () => import("./work-orders/new/page")],
  [/^\/dashboard\/production\/work-orders\/(?<id>[^/]+)$/, () => import("./work-orders/[id]/page")],
  [/^\/dashboard\/production\/work-orders\/(?<id>[^/]+)\/progress$/, () => import("./work-orders/[id]/progress/page")],
];

type Row = Record<string, unknown>;

// El arnes genera contadores altos: sin ordenes la version muestra sus enlaces de edicion.
const editableVersion: DataOverrides = {
  "version_receta.findFirst": (args) => {
    const version = generatedRow("version_receta", "findFirst", args) as Row;

    return {
      ...version,
      estado: "vigente",
      receta_tecnica: { ...(version.receta_tecnica as Row), estado: "activa" },
      _count: { ...(version._count as Row), orden_trabajo: 0 },
    };
  },
};

const activeRecipe: DataOverrides = {
  "receta_tecnica.findUnique": (args) => ({
    ...(generatedRow("receta_tecnica", "findUnique", args) as Row),
    estado: "activa",
  }),
};

const VERSION_ROUTE = "/dashboard/production/recipes/REC00000001/versions/VER00000001";
const VERSION_PARAMS = { id: "REC00000001", versionId: "VER00000001" };

const SOURCES: {
  name: string;
  route: string;
  load: PageLoader;
  params?: Record<string, string>;
  data?: DataOverrides;
}[] = [
  { name: "el inicio", route: "/dashboard/production", load: () => import("./page") },
  { name: "la lista de rutas", route: "/dashboard/production/routes", load: () => import("./routes/page") },
  {
    name: "la lista de etapas",
    route: "/dashboard/production/routes/RUT00000001/stages",
    load: () => import("./routes/[id]/stages/page"),
    params: { id: "RUT00000001" },
  },
  { name: "la lista de recetas", route: "/dashboard/production/recipes", load: () => import("./recipes/page") },
  {
    name: "las versiones de una receta",
    route: "/dashboard/production/recipes/REC00000001/versions",
    load: () => import("./recipes/[id]/versions/page"),
    params: { id: "REC00000001" },
    data: activeRecipe,
  },
  {
    name: "los materiales de una version",
    route: `${VERSION_ROUTE}/details`,
    load: () => import("./recipes/[id]/versions/[versionId]/details/page"),
    params: VERSION_PARAMS,
    data: editableVersion,
  },
  {
    name: "los requerimientos de una version",
    route: `${VERSION_ROUTE}/requirements`,
    load: () => import("./recipes/[id]/versions/[versionId]/requirements/page"),
    params: VERSION_PARAMS,
  },
  { name: "la lista de campanas", route: "/dashboard/production/campaigns", load: () => import("./campaigns/page") },
  {
    name: "el detalle de una campana",
    route: "/dashboard/production/campaigns/CAM00000001",
    load: () => import("./campaigns/[id]/page"),
    params: { id: "CAM00000001" },
  },
  { name: "la lista de ordenes", route: "/dashboard/production/work-orders", load: () => import("./work-orders/page") },
  { name: "cuellos de botella", route: "/dashboard/production/bottlenecks", load: () => import("./bottlenecks/page") },
];

function productionLinks(html: string) {
  const hrefs = [...html.matchAll(/<a [^>]*href="(\/dashboard\/production[^"?#]*)/g)].map((match) => match[1]);

  return [...new Set(hrefs)];
}

async function opens(href: string, role: Role) {
  const page = PAGES.map(([pattern, load]) => ({ match: pattern.exec(href), load })).find(({ match }) => match);

  if (!page?.match) {
    throw new Error(`Falta la pantalla de ${href} en la tabla de la prueba.`);
  }

  try {
    await characterizePage(page.load, { name: href, role, params: { ...page.match.groups } }, href);
    return true;
  } catch (error) {
    if (error instanceof AuthRejected) {
      return false;
    }

    throw error;
  }
}

// Las paginas se importan una vez antes de las pruebas: la primera importacion
// puede superar el plazo de una prueba con la suite completa.
preloadPages(...PAGES.map(([, load]) => load));

describe.each(["ADMIN", "WORKSHOP_MASTER"] as const)("enlaces de Produccion con %s", (role) => {
  it.each(SOURCES)("$name solo enlaza pantallas que el rol puede abrir", async ({ route, load, params, data }) => {
    const { outcome, html } = await characterizePage(load, { name: route, role, params, data }, route);

    expect(outcome).toBe("render");

    const links = productionLinks(html ?? "");
    const rejected: string[] = [];

    expect(links.length).toBeGreaterThan(0);

    for (const href of links) {
      if (!(await opens(href, role))) {
        rejected.push(href);
      }
    }

    expect(rejected).toEqual([]);
  });
});

describe("enlaces de una version editable", () => {
  it("los materiales enlazan el alta, la edicion y los requerimientos", async () => {
    const route = `${VERSION_ROUTE}/details`;
    const { html } = await characterizePage(
      () => import("./recipes/[id]/versions/[versionId]/details/page"),
      { name: route, params: VERSION_PARAMS, data: editableVersion },
      route,
    );
    const links = productionLinks(html ?? "");

    for (const ending of ["/details/new", "/edit", "/requirements"]) {
      expect(links.some((href) => href.endsWith(ending)), ending).toBe(true);
    }
  });
});

describe("tarjetas del inicio de Produccion", () => {
  it.each(["ADMIN", "WORKSHOP_MASTER"] as const)("%s ve las cinco y Nueva orden", async (role) => {
    const { html } = await characterizePage(() => import("./page"), { name: "inicio", role }, "/dashboard/production");

    expect(productionLinks(html ?? "").filter((href) => href !== "/dashboard/production")).toEqual([
      "/dashboard/production/work-orders/new",
      "/dashboard/production/routes",
      "/dashboard/production/recipes",
      "/dashboard/production/work-orders",
      "/dashboard/production/campaigns",
      "/dashboard/production/bottlenecks",
    ]);
  });
});
