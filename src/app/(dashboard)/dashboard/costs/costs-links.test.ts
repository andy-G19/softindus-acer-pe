import { describe, expect, it, vi } from "vitest";

import {
  AuthRejected,
  characterizePage,
  preloadPages,
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

// Entrega 10.8b (B7): Costos es solo del administrador. Sus pantallas solo enlazan
// pantallas que el administrador puede abrir, el inicio del sistema no muestra Costos al
// vendedor ni al maestro de taller, y ninguna pantalla de Costos anida un <main> dentro
// del del shell. La lista de costeos filtra con FilterBar y DateRangeFields.

// Pantalla de cada enlace, por su ruta sin la consulta; gana la primera que coincide. El
// grupo con nombre id es el parametro de la ruta. Un enlace sin fila en esta tabla hace
// fallar la prueba.
const PAGES: [RegExp, PageLoader][] = [
  [/^\/dashboard\/costs$/, () => import("./page")],
  [/^\/dashboard\/costs\/costings$/, () => import("./costings/page")],
  [/^\/dashboard\/costs\/costings\/(?<id>[^/]+)$/, () => import("./costings/[id]/page")],
  [/^\/dashboard\/costs\/work-orders$/, () => import("./work-orders/page")],
];

const SOURCES: { name: string; route: string; load: PageLoader }[] = [
  { name: "el inicio", route: "/dashboard/costs", load: () => import("./page") },
  { name: "la lista de costeos", route: "/dashboard/costs/costings", load: () => import("./costings/page") },
  { name: "las ordenes por costear", route: "/dashboard/costs/work-orders", load: () => import("./work-orders/page") },
];

function costsLinks(html: string) {
  const hrefs = [...html.matchAll(/<a [^>]*href="(\/dashboard\/costs[^"?#]*)/g)].map((match) => match[1]);

  return [...new Set(hrefs)];
}

async function opens(href: string, role: Role) {
  const page = PAGES.map(([pattern, load]) => ({ match: pattern.exec(href), load })).find(({ match }) => match);

  if (!page?.match) {
    throw new Error(`Falta la pantalla de ${href} en la tabla de la prueba.`);
  }

  const params: Record<string, string> = page.match.groups?.id ? { id: page.match.groups.id } : {};

  try {
    await characterizePage(page.load, { name: href, role, params }, href);
    return true;
  } catch (error) {
    if (error instanceof AuthRejected) {
      return false;
    }

    throw error;
  }
}

// Las paginas se importan una vez antes de las pruebas: la primera importacion puede
// superar el plazo de una prueba con la suite completa.
preloadPages(...PAGES.map(([, load]) => load), () => import("../page"));

describe("enlaces de Costos con ADMIN", () => {
  it.each(SOURCES)("$name solo enlaza pantallas que el administrador puede abrir", async ({ route, load }) => {
    const { outcome, html } = await characterizePage(load, { name: route, role: "ADMIN" }, route);

    expect(outcome).toBe("render");

    const links = costsLinks(html ?? "");
    const rejected: string[] = [];

    expect(links.length).toBeGreaterThan(0);

    for (const href of links) {
      if (!(await opens(href, "ADMIN"))) {
        rejected.push(href);
      }
    }

    expect(rejected).toEqual([]);
  });

  it.each(SOURCES)("$name no anida un main dentro del del shell", async ({ route, load }) => {
    const { html } = await characterizePage(load, { name: route, role: "ADMIN" }, route);

    expect(html ?? "").not.toContain("<main");
  });
});

describe("Costos en el inicio del sistema", () => {
  const home = async (role: Role) =>
    (await characterizePage(() => import("../page"), { name: "inicio", role }, "/dashboard")).html ?? "";

  it("el administrador ve Costos", async () => {
    expect(costsLinks(await home("ADMIN"))).toContain("/dashboard/costs");
  });

  it.each(["SELLER", "WORKSHOP_MASTER"] as const)("%s no ve ningun enlace a Costos", async (role) => {
    expect(costsLinks(await home(role))).toEqual([]);
  });
});

describe("filtros de la lista de costeos", () => {
  const list = async (searchParams: Record<string, string> = {}) =>
    (
      await characterizePage(
        () => import("./costings/page"),
        { name: "costeos", role: "ADMIN", searchParams },
        "/dashboard/costs/costings",
      )
    ).html ?? "";

  it("usa FilterBar con su etiqueta", async () => {
    expect(await list()).toContain('role="search" aria-label="Filtros de costeos"');
  });

  it("el rango de fechas usa DateRangeFields: Hasta no acepta un dia anterior a Desde", async () => {
    const html = await list({ from: "2026-11-10", to: "2026-11-20" });

    expect(html).toMatch(/<input[^>]*id="fecha-desde"[^>]*name="from"/);
    expect(html).toMatch(/<input[^>]*id="fecha-hasta"[^>]*min="2026-11-10"[^>]*name="to"/);
  });
});
