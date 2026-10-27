import { describe, expect, it, vi } from "vitest";

import {
  AuthRejected,
  characterizePage,
  generatedResult,
  preloadPages,
  type DataOverrides,
  type PageLoader,
  type PrismaArgs,
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

// Entrega 10.4a: los enlaces de Comercial siguen los roles de su destino, como
// los de Inventario en la 10.3c. La prueba abre cada enlace de Comercial del
// inicio, las listas y los detalles con el mismo rol, y falla si la pantalla
// lo rechaza o si no figura en su tabla. Ademas, cada lista que el rol puede
// abrir tiene una tarjeta en el inicio: antes, Pagos de cliente y Comprobantes
// de venta solo se enlazaban desde el inicio de Reportes, que es solo de
// ADMIN, y el vendedor no llegaba a ellas.

// Pantalla de cada enlace, por su ruta sin la consulta; gana la primera que
// coincide. Un enlace sin fila en esta tabla hace fallar la prueba.
const PAGES: [RegExp, PageLoader][] = [
  [/^\/dashboard\/commercial$/, () => import("./page")],
  [/^\/dashboard\/commercial\/clients$/, () => import("./clients/page")],
  [/^\/dashboard\/commercial\/clients\/new$/, () => import("./clients/new/page")],
  [/^\/dashboard\/commercial\/clients\/[^/]+\/edit$/, () => import("./clients/[id]/edit/page")],
  [/^\/dashboard\/commercial\/products$/, () => import("./products/page")],
  [/^\/dashboard\/commercial\/products\/new$/, () => import("./products/new/page")],
  [/^\/dashboard\/commercial\/products\/[^/]+\/edit$/, () => import("./products/[id]/edit/page")],
  [/^\/dashboard\/commercial\/product-categories$/, () => import("./product-categories/page")],
  [/^\/dashboard\/commercial\/orders$/, () => import("./orders/page")],
  [/^\/dashboard\/commercial\/orders\/new$/, () => import("./orders/new/page")],
  [/^\/dashboard\/commercial\/orders\/[^/]+\/edit$/, () => import("./orders/[id]/edit/page")],
  [/^\/dashboard\/commercial\/orders\/[^/]+$/, () => import("./orders/[id]/page")],
  [/^\/dashboard\/commercial\/quotes$/, () => import("./quotes/page")],
  [/^\/dashboard\/commercial\/quotes\/new$/, () => import("./quotes/new/page")],
  [/^\/dashboard\/commercial\/quotes\/[^/]+$/, () => import("./quotes/[id]/page")],
  [/^\/dashboard\/commercial\/receipts$/, () => import("./receipts/page")],
  [/^\/dashboard\/commercial\/payments$/, () => import("./payments/page")],
];

// Los datos generados dan a cada pedido una proforma activa, asi que la lista
// nunca enlazaba «Editar» ni «Generar proforma» (10.4b): esta fuente agrega un
// pedido registrado sin proforma, comprobantes ni ordenes de trabajo.
const WITH_EDITABLE_ORDER: DataOverrides = {
  "pedido.findMany": (args: PrismaArgs) => {
    const [first, ...rest] = generatedResult("pedido", "findMany", args) as Record<string, unknown>[];
    const details = first.detalle_pedido as Record<string, unknown>[];

    return [
      {
        ...first,
        estado: "registrado",
        proforma: [],
        comprobante_venta: [],
        detalle_pedido: details.map((detail) => ({ ...detail, orden_trabajo: [] })),
      },
      ...rest,
    ];
  },
};

const SOURCES: {
  name: string;
  route: string;
  load: PageLoader;
  params?: Record<string, string>;
  data?: DataOverrides;
}[] = [
  { name: "el inicio", route: "/dashboard/commercial", load: () => import("./page") },
  { name: "la lista de clientes", route: "/dashboard/commercial/clients", load: () => import("./clients/page") },
  { name: "la lista de productos", route: "/dashboard/commercial/products", load: () => import("./products/page") },
  {
    name: "las categorias de producto",
    route: "/dashboard/commercial/product-categories",
    load: () => import("./product-categories/page"),
  },
  { name: "la lista de pedidos", route: "/dashboard/commercial/orders", load: () => import("./orders/page") },
  {
    name: "la lista de pedidos con un pedido editable",
    route: "/dashboard/commercial/orders",
    load: () => import("./orders/page"),
    data: WITH_EDITABLE_ORDER,
  },
  {
    name: "el detalle de un pedido",
    route: "/dashboard/commercial/orders/PED00000001",
    load: () => import("./orders/[id]/page"),
    params: { id: "PED00000001" },
  },
  { name: "la lista de proformas", route: "/dashboard/commercial/quotes", load: () => import("./quotes/page") },
  {
    name: "el detalle de una proforma",
    route: "/dashboard/commercial/quotes/PRF00000001",
    load: () => import("./quotes/[id]/page"),
    params: { id: "PRF00000001" },
  },
  { name: "la lista de comprobantes", route: "/dashboard/commercial/receipts", load: () => import("./receipts/page") },
  { name: "la lista de pagos de cliente", route: "/dashboard/commercial/payments", load: () => import("./payments/page") },
];

// Listas del area: cada una debe tener su tarjeta en el inicio.
const LISTS = [
  "/dashboard/commercial/clients",
  "/dashboard/commercial/products",
  "/dashboard/commercial/orders",
  "/dashboard/commercial/quotes",
  "/dashboard/commercial/payments",
  "/dashboard/commercial/receipts",
];

function commercialLinks(html: string) {
  const hrefs = [...html.matchAll(/<a [^>]*href="(\/dashboard\/commercial[^"?#]*)/g)].map(
    (match) => match[1],
  );

  return [...new Set(hrefs)];
}

// El id de la ruta: el ultimo segmento, o el anterior en una edicion.
function idOf(href: string) {
  const segments = href.split("/");
  const last = segments.pop() ?? "";

  return last === "edit" ? (segments.pop() ?? "") : last;
}

async function opens(href: string, role: Role) {
  const page = PAGES.find(([pattern]) => pattern.test(href));

  if (!page) {
    throw new Error(`Falta la pantalla de ${href} en la tabla de la prueba.`);
  }

  try {
    await characterizePage(page[1], { name: href, role, params: { id: idOf(href) } }, href);
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

describe.each(["ADMIN", "SELLER"] as const)("enlaces de Comercial con %s", (role) => {
  it.each(SOURCES)("$name solo enlaza pantallas que el rol puede abrir", async ({ route, load, params, data }) => {
    const { outcome, html } = await characterizePage(load, { name: route, role, params, data }, route);

    expect(outcome).toBe("render");

    const links = commercialLinks(html ?? "");
    const rejected: string[] = [];

    expect(links.length).toBeGreaterThan(0);

    for (const href of links) {
      if (!(await opens(href, role))) {
        rejected.push(href);
      }
    }

    expect(rejected).toEqual([]);
  });

  it("el inicio tiene una tarjeta para cada lista del area", async () => {
    const { html } = await characterizePage(() => import("./page"), { name: "inicio", role }, "/dashboard/commercial");
    const links = commercialLinks(html ?? "");

    expect(LISTS.filter((list) => !links.includes(list))).toEqual([]);
  });

  it("la lista de pedidos con un pedido editable enlaza su edicion y su proforma nueva", async () => {
    const { html } = await characterizePage(
      () => import("./orders/page"),
      { name: "pedido editable", role, data: WITH_EDITABLE_ORDER },
      "/dashboard/commercial/orders",
    );
    const links = commercialLinks(html ?? "");

    expect(links).toContain("/dashboard/commercial/orders/id_pedido-1/edit");
    expect(links).toContain("/dashboard/commercial/quotes/new");
  });
});
