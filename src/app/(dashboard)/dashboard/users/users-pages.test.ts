import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { characterizePage, definePageSuite, generatedRow } from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
// RouteSheet pinta su contenido en un portal, que no existe en el render de
// servidor: el HTML de un panel sale vacio. El doble lo deja en linea para que la
// prueba vea el titulo y el formulario del panel.
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

// Caracterizacion de Usuarios (entrega 4.5), escrita antes
// de mover sus consultas a modules/users/queries.ts.

// El usuario editado es el de la sesion: la pagina impide cambiar su propio rol.
const sessionUser = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("usuario", "findUnique", args),
  id_usuario: "USU00000001",
});

definePageSuite([
  {
    route: "/dashboard/users",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: { q: "ana", rol: "SELLER", estado: "activo", page: "2" },
      },
      { name: "estado desconocido no filtra", searchParams: { estado: "todos" } },
    ],
  },
  {
    route: "/dashboard/users/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "vuelve al returnTo", searchParams: { returnTo: "/dashboard/users?estado=inactivo" } },
      { name: "un returnTo ajeno vuelve a la lista", searchParams: { returnTo: "https://otro.example/x" } },
    ],
  },
  {
    route: "/dashboard/users/@panel/(.)new",
    load: () => import("./@panel/(.)new/page"),
    cases: [{ name: "panel de alta" }],
  },
  {
    route: "/dashboard/users/@panel/(.)[id]/edit",
    load: () => import("./@panel/(.)[id]/edit/page"),
    cases: [
      { name: "panel de edicion", params: { id: "USU00000002" } },
      {
        name: "panel del propio usuario",
        params: { id: "USU00000001" },
        data: { "usuario.findUnique": sessionUser },
      },
      {
        name: "inexistente",
        params: { id: "USU99999999" },
        data: { "usuario.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/users/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "editar otro usuario", params: { id: "USU00000002" } },
      {
        name: "vuelve al returnTo",
        params: { id: "USU00000002" },
        searchParams: { returnTo: "/dashboard/users?rol=SELLER" },
      },
      {
        name: "editar el propio usuario",
        params: { id: "USU00000001" },
        data: { "usuario.findUnique": sessionUser },
      },
      {
        name: "inexistente",
        params: { id: "USU99999999" },
        data: { "usuario.findUnique": null },
      },
    ],
  },
]);

// D3 de la 10.7: restablecer la contrasena es una ventana de la fila, sin pagina
// propia.
describe("restablecer desde la lista", () => {
  it("la fila abre la ventana y no enlaza a la pagina retirada", async () => {
    const { html } = await characterizePage(() => import("./page"), { name: "lista" }, "/dashboard/users");

    expect(html).toContain("Resetear contraseña");
    expect(html).not.toContain("/reset-password");
  });
});

// La fila del usuario de la sesion ofrece Desactivar deshabilitado; la de otro, no.
describe("estado desde la lista", () => {
  it("el administrador no puede desactivarse desde su fila", async () => {
    const row = (id_usuario: string) => (args: Parameters<typeof generatedRow>[2]) => ({
      ...generatedRow("usuario", "findUnique", args),
      id_usuario,
      estado: "activo",
    });
    const { html } = await characterizePage(
      () => import("./page"),
      {
        name: "lista con el propio usuario",
        data: {
          "usuario.findMany": (args) => [row("USU00000001")(args), row("USU00000002")(args)],
        },
      },
      "/dashboard/users",
    );
    const deactivate = [...(html ?? "").matchAll(/<button[^>]*>Desactivar<\/button>/g)].map((match) => match[0]);

    expect(deactivate).toHaveLength(2);
    expect(deactivate[0]).toContain('aria-disabled="true"');
    expect(deactivate[1]).not.toContain("aria-disabled");
  });
});
