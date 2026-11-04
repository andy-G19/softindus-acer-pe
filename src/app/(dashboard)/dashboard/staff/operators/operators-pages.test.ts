import { createElement, type ReactNode } from "react";
import { vi } from "vitest";

import { definePageSuite } from "@/testing/page-characterization";

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
// RouteSheet pinta su contenido en un portal, que no existe en el render de
// servidor: el HTML de un panel sale vacio. El doble lo deja en linea para que la
// prueba vea el titulo y el formulario del panel.
vi.mock("@/components/navigation/route-sheet", () => ({
  RouteSheet: ({ title, description, children }: { title: string; description?: string; children: ReactNode }) =>
    createElement("section", null, createElement("h2", null, title), createElement("p", null, description), children),
}));

// Caracterizacion de Operarios (entrega 4.5), escrita antes
// de mover sus consultas a modules/staff/operators/queries.ts. Desde A6 de la
// 10.8a el alta y la edicion tambien se abren en un panel sobre la lista.

definePageSuite([
  {
    route: "/dashboard/staff/operators",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "filtros y maestro de taller",
        role: "WORKSHOP_MASTER",
        searchParams: {
          q: "juan",
          cargo: "soldador",
          especialidad: "estructuras",
          modalidad: "diario",
          status: "activo",
        },
      },
    ],
  },
  {
    route: "/dashboard/staff/operators/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar", params: { id: "OPE00000001" } },
      {
        name: "vuelve al returnTo",
        params: { id: "OPE00000001" },
        searchParams: { returnTo: "/dashboard/staff/operators?status=activo" },
      },
      {
        name: "inexistente",
        params: { id: "OPE99999999" },
        data: { "operario.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/staff/operators/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "vuelve al returnTo", searchParams: { returnTo: "/dashboard/staff/operators?status=inactivo" } },
      { name: "un returnTo ajeno vuelve a la lista", searchParams: { returnTo: "https://otro.example/x" } },
    ],
  },
  {
    route: "/dashboard/staff/operators/@panel/(.)new",
    load: () => import("./@panel/(.)new/page"),
    cases: [{ name: "panel de alta" }],
  },
  {
    route: "/dashboard/staff/operators/@panel/(.)[id]/edit",
    load: () => import("./@panel/(.)[id]/edit/page"),
    cases: [
      { name: "panel de edicion", params: { id: "OPE00000001" } },
      {
        name: "inexistente",
        params: { id: "OPE99999999" },
        data: { "operario.findUnique": null },
      },
    ],
  },
]);
