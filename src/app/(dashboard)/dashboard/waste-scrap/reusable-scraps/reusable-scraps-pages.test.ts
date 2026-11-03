import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { characterizePage, definePageSuite, generatedRow } from "@/testing/page-characterization";

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

// Caracterizacion de Retazos reutilizables (entrega 4.6), escrita antes
// de mover sus consultas a modules/waste-scrap/reusable-scraps/queries.ts.

// Un retazo por estado: solo el disponible ofrece acciones.
const scrapsIn =
  (...estados: string[]) =>
  (args: Parameters<typeof generatedRow>[2]) =>
    estados.map((estado, index) => ({
      ...generatedRow("retazo_reutilizable", "findUnique", args),
      id_retazo: `RET0000000${index + 1}`,
      estado,
    }));

definePageSuite([
  {
    route: "/dashboard/waste-scrap/reusable-scraps",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "acciones de cada estado",
        data: {
          "retazo_reutilizable.findMany": scrapsIn("disponible", "reutilizado", "descartado"),
        },
      },
      { name: "sin retazos", data: { "retazo_reutilizable.findMany": [] } },
      {
        name: "todos los filtros",
        searchParams: { estado: "disponible", material: "MAT00000001", q: "plancha" },
      },
    ],
  },
  {
    route: "/dashboard/waste-scrap/reusable-scraps/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "sin materiales", data: { "material.findMany": [] } },
      { name: "vuelve al returnTo", searchParams: { returnTo: "/dashboard/waste-scrap/reusable-scraps?estado=descartado" } },
      { name: "un returnTo ajeno vuelve a la lista", searchParams: { returnTo: "https://otro.example/x" } },
    ],
  },
  {
    route: "/dashboard/waste-scrap/reusable-scraps/@panel/(.)new",
    load: () => import("./@panel/(.)new/page"),
    cases: [{ name: "panel de alta" }, { name: "maestro de taller", role: "WORKSHOP_MASTER" }],
  },
]);

// A12: la lista usa la barra compartida, conserva sus filtros al abrir el panel y la
// pagina no anida otro main.
describe("lista de retazos", () => {
  it("filtra con FilterBar y enlaza el alta con su returnTo", async () => {
    const { html } = await characterizePage(
      () => import("./page"),
      { name: "lista", searchParams: { estado: "disponible", q: "plancha" } },
      "/dashboard/waste-scrap/reusable-scraps",
    );

    expect(html).toContain('aria-label="Filtros de retazos"');
    expect(html).toContain("/dashboard/waste-scrap/reusable-scraps/new?returnTo=");
    expect(html).toContain(encodeURIComponent("estado=disponible"));
    expect(html).not.toContain("<main");
  });
});
