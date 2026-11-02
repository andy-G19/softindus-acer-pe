import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { characterizePage, definePageSuite } from "@/testing/page-characterization";

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

// Caracterizacion de Chatarra (entrega 4.6), escrita antes
// de mover sus consultas a modules/waste-scrap/scraps/queries.ts.

definePageSuite([
  {
    route: "/dashboard/waste-scrap/scraps",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "filtros y maestro de taller",
        role: "WORKSHOP_MASTER",
        searchParams: { estado: "acumulada", material: "MAT00000001", q: "viruta" },
      },
    ],
  },
  {
    route: "/dashboard/waste-scrap/scraps/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "vuelve al returnTo", searchParams: { returnTo: "/dashboard/waste-scrap/scraps?estado=vendida" } },
      { name: "un returnTo ajeno vuelve a la lista", searchParams: { returnTo: "https://otro.example/x" } },
    ],
  },
  {
    route: "/dashboard/waste-scrap/scraps/@panel/(.)new",
    load: () => import("./@panel/(.)new/page"),
    cases: [{ name: "panel de alta" }, { name: "maestro de taller", role: "WORKSHOP_MASTER" }],
  },
]);

// A11: la lista usa la barra compartida, conserva sus filtros al abrir el panel y la
// pagina no anida otro main.
describe("lista de chatarra", () => {
  it("filtra con FilterBar y enlaza el alta con su returnTo", async () => {
    const { html } = await characterizePage(
      () => import("./page"),
      { name: "lista", searchParams: { estado: "acumulada", q: "viruta" } },
      "/dashboard/waste-scrap/scraps",
    );

    expect(html).toContain('aria-label="Filtros de chatarra"');
    expect(html).toContain("/dashboard/waste-scrap/scraps/new?returnTo=");
    expect(html).toContain(encodeURIComponent("estado=acumulada"));
    expect(html).not.toContain("<main");
  });
});
