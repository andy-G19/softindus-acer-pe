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

// Entrega 10.7a: las pantallas de Mermas solo enlazan pantallas que el rol puede abrir.
// La prueba abre cada enlace con el mismo rol: si el requireRole de la pantalla lo
// rechaza, falla aqui. Registrar una venta es solo de ADMIN: el maestro de taller no
// debe ver ese enlace, y si lo viera esta prueba lo diria.

// Pantalla de cada enlace, por su ruta sin la consulta. Un enlace sin fila en esta
// tabla hace fallar la prueba.
const PAGES: [RegExp, PageLoader][] = [
  [/^\/dashboard\/waste-scrap$/, () => import("./page")],
  [/^\/dashboard\/waste-scrap\/scraps$/, () => import("./scraps/page")],
  [/^\/dashboard\/waste-scrap\/scraps\/new$/, () => import("./scraps/new/page")],
  [/^\/dashboard\/waste-scrap\/reusable-scraps$/, () => import("./reusable-scraps/page")],
  [/^\/dashboard\/waste-scrap\/reusable-scraps\/new$/, () => import("./reusable-scraps/new/page")],
  [/^\/dashboard\/waste-scrap\/scrap-sales\/new$/, () => import("./scrap-sales/new/page")],
];

const HOME = "/dashboard/waste-scrap";

const SOURCES: { name: string; route: string; load: PageLoader }[] = [
  { name: "el inicio", route: HOME, load: () => import("./page") },
  { name: "la lista de chatarra", route: `${HOME}/scraps`, load: () => import("./scraps/page") },
  { name: "la lista de retazos", route: `${HOME}/reusable-scraps`, load: () => import("./reusable-scraps/page") },
];

function wasteLinks(html: string) {
  const hrefs = [...html.matchAll(/<a [^>]*href="(\/dashboard\/waste-scrap[^"?#]*)/g)].map((match) => match[1]);

  return [...new Set(hrefs)];
}

async function opens(href: string, role: Role) {
  const load = PAGES.find(([pattern]) => pattern.test(href))?.[1];

  if (!load) {
    throw new Error(`Falta la pantalla de ${href} en la tabla de la prueba.`);
  }

  try {
    await characterizePage(load, { name: href, role }, href);
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

describe.each(["ADMIN", "WORKSHOP_MASTER"] as const)("enlaces de Mermas con %s", (role) => {
  it.each(SOURCES)("$name solo enlaza pantallas que el rol puede abrir", async ({ route, load }) => {
    const { outcome, html } = await characterizePage(load, { name: route, role }, route);

    expect(outcome).toBe("render");

    const links = wasteLinks(html ?? "");
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

describe("registrar una venta es solo de ADMIN", () => {
  it.each(SOURCES.filter(({ route }) => route !== `${HOME}/reusable-scraps`))("$name la ofrece a ADMIN", async ({ route, load }) => {
    const { html } = await characterizePage(load, { name: route, role: "ADMIN" }, route);

    expect(wasteLinks(html ?? "")).toContain(`${HOME}/scrap-sales/new`);
  });

  it.each(SOURCES)("$name no la ofrece al maestro de taller", async ({ route, load }) => {
    const { html } = await characterizePage(load, { name: route, role: "WORKSHOP_MASTER" }, route);

    expect(wasteLinks(html ?? "")).not.toContain(`${HOME}/scrap-sales/new`);
  });
});

// El inicio no lleva el panel: sus altas son la pagina completa, y al guardar o cancelar
// vuelven al inicio, como antes de la 10.7a.
describe("el inicio de Mermas", () => {
  const home = () => characterizePage(() => import("./page"), { name: "inicio" }, HOME);

  it.each(["scraps", "reusable-scraps"])("el alta de %s vuelve al inicio", async (area) => {
    const { html } = await home();

    expect(html).toContain(`${HOME}/${area}/new?returnTo=${encodeURIComponent(HOME)}`);
  });

  it("no anida otro main y no llama opcional a la orden de un retazo", async () => {
    const { html } = await home();

    expect(html).not.toContain("<main");
    expect(html).not.toContain("orden relacionada opcional");
  });

  it("la venta tampoco anida otro main", async () => {
    const { html } = await characterizePage(
      () => import("./scrap-sales/new/page"),
      { name: "venta" },
      `${HOME}/scrap-sales/new`,
    );

    expect(html).not.toContain("<main");
  });
});
