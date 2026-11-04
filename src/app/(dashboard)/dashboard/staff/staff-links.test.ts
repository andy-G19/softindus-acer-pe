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

// Entrega 10.8a (hallazgo 67): el inicio de Personal y las listas que abre el
// maestro de taller solo enlazan pantallas que el rol puede abrir. Antes el
// maestro de taller veia en el inicio Planillas e Historial de pagos, que lo
// llevaban a «acceso denegado», y las tarjetas de Operarios y Asistencia decian
// «Acceso: ADMIN» aunque el puede abrirlas. La prueba abre cada enlace de
// Personal con el mismo rol: si el requireRole de la pantalla lo rechaza, falla
// aqui, asi que los enlaces no pueden quedar desfasados de las paginas.

// Pantalla de cada enlace, por su ruta sin la consulta; gana la primera que
// coincide. El grupo con nombre id es el parametro de la ruta. Un enlace sin
// fila en esta tabla hace fallar la prueba.
const PAGES: [RegExp, PageLoader][] = [
  [/^\/dashboard\/staff$/, () => import("./page")],
  [/^\/dashboard\/staff\/operators$/, () => import("./operators/page")],
  [/^\/dashboard\/staff\/operators\/new$/, () => import("./operators/new/page")],
  [/^\/dashboard\/staff\/operators\/(?<id>[^/]+)\/edit$/, () => import("./operators/[id]/edit/page")],
  [/^\/dashboard\/staff\/attendance$/, () => import("./attendance/page")],
  [/^\/dashboard\/staff\/attendance\/new$/, () => import("./attendance/new/page")],
  [/^\/dashboard\/staff\/tasks$/, () => import("./tasks/page")],
  [/^\/dashboard\/staff\/tasks\/new$/, () => import("./tasks/new/page")],
  [/^\/dashboard\/staff\/payrolls$/, () => import("./payrolls/page")],
  [/^\/dashboard\/staff\/payrolls\/new$/, () => import("./payrolls/new/page")],
  [/^\/dashboard\/staff\/payment-history$/, () => import("./payment-history/page")],
  [/^\/dashboard\/staff\/payment-history\/new$/, () => import("./payment-history/new/page")],
];

// Las pantallas que los dos roles pueden abrir.
const SOURCES: { name: string; route: string; load: PageLoader }[] = [
  { name: "el inicio", route: "/dashboard/staff", load: () => import("./page") },
  { name: "la lista de operarios", route: "/dashboard/staff/operators", load: () => import("./operators/page") },
  { name: "la lista de asistencia", route: "/dashboard/staff/attendance", load: () => import("./attendance/page") },
  { name: "la lista de tareas", route: "/dashboard/staff/tasks", load: () => import("./tasks/page") },
];

function staffLinks(html: string) {
  const hrefs = [...html.matchAll(/<a [^>]*href="(\/dashboard\/staff[^"?#]*)/g)].map((match) => match[1]);

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

describe.each(["ADMIN", "WORKSHOP_MASTER"] as const)("enlaces de Personal con %s", (role) => {
  it.each(SOURCES)("$name solo enlaza pantallas que el rol puede abrir", async ({ route, load }) => {
    const { outcome, html } = await characterizePage(load, { name: route, role }, route);

    expect(outcome).toBe("render");

    const links = staffLinks(html ?? "");
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

// Las tarjetas del inicio que ve cada rol y el acceso que declaran: el maestro de
// taller solo ve las pantallas que admite su requireRole.
describe("tarjetas del inicio de Personal", () => {
  const home = async (role: Role) =>
    (await characterizePage(() => import("./page"), { name: "inicio", role }, "/dashboard/staff")).html ?? "";
  const cards = (html: string) => staffLinks(html).filter((href) => href !== "/dashboard/staff");

  it("ADMIN ve las cinco", async () => {
    expect(cards(await home("ADMIN"))).toEqual([
      "/dashboard/staff/operators",
      "/dashboard/staff/attendance",
      "/dashboard/staff/tasks",
      "/dashboard/staff/payrolls",
      "/dashboard/staff/payment-history",
    ]);
  });

  it("el maestro de taller ve Operarios, Asistencia y Tareas", async () => {
    expect(cards(await home("WORKSHOP_MASTER"))).toEqual([
      "/dashboard/staff/operators",
      "/dashboard/staff/attendance",
      "/dashboard/staff/tasks",
    ]);
  });

  it("cada tarjeta declara el acceso que admite su pantalla", async () => {
    const html = await home("ADMIN");

    expect(html).toContain("Registrar y consultar trabajadores del taller. Acceso: ADMIN; maestro de taller, solo consulta.");
    expect(html).toContain("Registrar ingreso, salida, tardanza o falta. Acceso: ADMIN / Maestro de taller.");
    expect(html).toContain("Registrar actividades realizadas por operario. Acceso: ADMIN / Maestro de taller.");
    expect(html).toContain("Generar pagos según asistencia y modalidad. Acceso: ADMIN.");
    expect(html).toContain("Consultar pagos realizados a operarios. Acceso: ADMIN.");
  });
});
