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

// Entrega 10.3c: el inicio de Inventario y la lista de entradas solo enlazan
// pantallas que el rol puede abrir. Antes el maestro de taller veia en el
// inicio Proveedores, Proveedor-material y Compras, y en las entradas «Ver
// compra», y todos lo llevaban a «acceso denegado». La prueba abre cada enlace
// de Inventario con el mismo rol: si el requireRole de la pantalla lo rechaza,
// falla aqui, asi que los enlaces no pueden quedar desfasados de las paginas.

// Pantalla de cada enlace, por su ruta sin la consulta; gana la primera que
// coincide. Un enlace sin fila en esta tabla hace fallar la prueba.
const PAGES: [RegExp, PageLoader][] = [
  [/^\/dashboard\/inventory$/, () => import("./page")],
  [/^\/dashboard\/inventory\/materials$/, () => import("./materials/page")],
  [/^\/dashboard\/inventory\/suppliers$/, () => import("./suppliers/page")],
  [/^\/dashboard\/inventory\/supplier-materials$/, () => import("./supplier-materials/page")],
  [/^\/dashboard\/inventory\/purchases$/, () => import("./purchases/page")],
  [/^\/dashboard\/inventory\/purchases\/new$/, () => import("./purchases/new/page")],
  [/^\/dashboard\/inventory\/purchases\/[^/]+$/, () => import("./purchases/[id]/page")],
  [/^\/dashboard\/inventory\/alerts$/, () => import("./alerts/page")],
  [/^\/dashboard\/inventory\/entries$/, () => import("./entries/page")],
  [/^\/dashboard\/inventory\/outputs$/, () => import("./outputs/page")],
  [/^\/dashboard\/inventory\/supplier-payments$/, () => import("./supplier-payments/page")],
];

const SOURCES: { name: string; route: string; load: PageLoader }[] = [
  { name: "el inicio", route: "/dashboard/inventory", load: () => import("./page") },
  { name: "la lista de entradas", route: "/dashboard/inventory/entries", load: () => import("./entries/page") },
];

function inventoryLinks(html: string) {
  const hrefs = [...html.matchAll(/<a [^>]*href="(\/dashboard\/inventory[^"?#]*)/g)].map(
    (match) => match[1],
  );

  return [...new Set(hrefs)];
}

async function opens(href: string, role: Role) {
  const page = PAGES.find(([pattern]) => pattern.test(href));

  if (!page) {
    throw new Error(`Falta la pantalla de ${href} en la tabla de la prueba.`);
  }

  try {
    await characterizePage(page[1], { name: href, role, params: { id: href.split("/").pop() ?? "" } }, href);
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

describe.each(["ADMIN", "WORKSHOP_MASTER"] as const)("enlaces de Inventario con %s", (role) => {
  it.each(SOURCES)("$name solo enlaza pantallas que el rol puede abrir", async ({ route, load }) => {
    const { outcome, html } = await characterizePage(load, { name: route, role }, route);

    expect(outcome).toBe("render");

    const links = inventoryLinks(html ?? "");
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
