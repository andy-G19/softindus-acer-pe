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

// Entrega 10.5a: el inicio de Mantenimiento y las listas que abre el maestro
// de taller solo enlazan pantallas que el rol puede abrir. Antes el maestro de
// taller veia en el inicio Repuestos, Reparaciones, Preventivos y
// Reincidencias, y todas lo llevaban a «acceso denegado». La prueba abre cada
// enlace de Mantenimiento con el mismo rol: si el requireRole de la pantalla lo
// rechaza, falla aqui, asi que los enlaces no pueden quedar desfasados de las
// paginas.

// Pantalla de cada enlace, por su ruta sin la consulta; gana la primera que
// coincide. El grupo con nombre id es el parametro de la ruta. Un enlace sin
// fila en esta tabla hace fallar la prueba.
const PAGES: [RegExp, PageLoader][] = [
  [/^\/dashboard\/maintenance$/, () => import("./page")],
  [/^\/dashboard\/maintenance\/machines$/, () => import("./machines/page")],
  [/^\/dashboard\/maintenance\/machines\/new$/, () => import("./machines/new/page")],
  [/^\/dashboard\/maintenance\/machines\/(?<id>[^/]+)\/edit$/, () => import("./machines/[id]/edit/page")],
  [/^\/dashboard\/maintenance\/failures$/, () => import("./failures/page")],
  [/^\/dashboard\/maintenance\/failures\/new$/, () => import("./failures/new/page")],
  [/^\/dashboard\/maintenance\/spare-parts$/, () => import("./spare-parts/page")],
  [/^\/dashboard\/maintenance\/repairs$/, () => import("./repairs/page")],
  [/^\/dashboard\/maintenance\/preventive$/, () => import("./preventive/page")],
  [/^\/dashboard\/maintenance\/recurrences$/, () => import("./recurrences/page")],
];

// Las pantallas que los dos roles pueden abrir.
const SOURCES: { name: string; route: string; load: PageLoader }[] = [
  { name: "el inicio", route: "/dashboard/maintenance", load: () => import("./page") },
  { name: "la lista de maquinas", route: "/dashboard/maintenance/machines", load: () => import("./machines/page") },
  { name: "la lista de fallas", route: "/dashboard/maintenance/failures", load: () => import("./failures/page") },
];

function maintenanceLinks(html: string) {
  const hrefs = [...html.matchAll(/<a [^>]*href="(\/dashboard\/maintenance[^"?#]*)/g)].map(
    (match) => match[1],
  );

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

// Las paginas se importan una vez antes de las pruebas: la primera importacion
// puede superar el plazo de una prueba con la suite completa.
preloadPages(...PAGES.map(([, load]) => load));

describe.each(["ADMIN", "WORKSHOP_MASTER"] as const)("enlaces de Mantenimiento con %s", (role) => {
  it.each(SOURCES)("$name solo enlaza pantallas que el rol puede abrir", async ({ route, load }) => {
    const { outcome, html } = await characterizePage(load, { name: route, role }, route);

    expect(outcome).toBe("render");

    const links = maintenanceLinks(html ?? "");
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

// Las tarjetas del inicio que ve cada rol: el maestro de taller solo las dos
// pantallas que admite su requireRole.
describe("tarjetas del inicio de Mantenimiento", () => {
  const cards = async (role: Role) => {
    const { html } = await characterizePage(() => import("./page"), { name: "inicio", role }, "/dashboard/maintenance");

    return maintenanceLinks(html ?? "").filter((href) => href !== "/dashboard/maintenance");
  };

  it("ADMIN ve las seis", async () => {
    expect(await cards("ADMIN")).toEqual([
      "/dashboard/maintenance/machines",
      "/dashboard/maintenance/failures",
      "/dashboard/maintenance/spare-parts",
      "/dashboard/maintenance/repairs",
      "/dashboard/maintenance/preventive",
      "/dashboard/maintenance/recurrences",
    ]);
  });

  it("el maestro de taller ve Maquinas y Fallas", async () => {
    expect(await cards("WORKSHOP_MASTER")).toEqual([
      "/dashboard/maintenance/machines",
      "/dashboard/maintenance/failures",
    ]);
  });
});
