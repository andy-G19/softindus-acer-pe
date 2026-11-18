import { createElement as h, Fragment, type ReactNode } from "react";
import type { Session } from "next-auth";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/(auth)/login/page";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LoginForm } from "@/modules/auth/components/login-form";
import { DashboardStatusCards } from "@/modules/dashboard/components/dashboard-status-cards";

// Caracterizacion visual de las superficies de la aplicacion (entrega 8): el
// shell del dashboard, la pantalla de login y la tarjeta de sesion. Fija su HTML
// completo, con clases y estilos en linea, porque son las superficies con
// colores literales que la base visual sustituye por tokens. Como en
// primitives.test.ts, el aspecto calculado se compara aparte con la huella
// visual de staging.

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRouter: () => ({ back() {}, forward() {}, push() {}, replace() {}, refresh() {}, prefetch() {} }),
  usePathname: () => "/dashboard/commercial/clients",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/auth", () => ({ signOut: vi.fn(), signIn: vi.fn() }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/authz", () => ({ getActiveUserSession: async () => null }));
vi.mock("@/modules/auth/actions/login.action", () => ({ loginAction: vi.fn() }));
vi.mock("react-toastify", async () =>
  (await import("@/testing/notification-doubles")).toastifyModuleMock(),
);

// Una etiqueta por linea: el diff de un snapshot senala el elemento que cambio.
function markup(node: ReactNode) {
  return renderToStaticMarkup(h(Fragment, null, node)).replace(/></g, ">\n<");
}

function session(role: string): Session {
  return {
    user: {
      id: "USR00000001",
      name: "Ana Torres",
      email: "ana.torres@acerosperu.test",
      role,
      status: "activo",
    },
    expires: "2026-12-31T00:00:00.000Z",
  };
}

describe("superficies de la aplicacion", () => {
  it("shell del dashboard con el menu de ADMIN", () => {
    expect(
      markup(h(DashboardShell, { session: session("ADMIN"), children: h("p", null, "Contenido de la pagina") })),
    ).toMatchSnapshot();
  });

  it("tarjeta de sesion del dashboard", () => {
    expect(markup(h(DashboardStatusCards, { session: session("SELLER") }))).toMatchSnapshot();
  });

  it("pantalla de login sin sesion", async () => {
    expect(markup(await LoginPage())).toMatchSnapshot();
  });

  it("formulario de login", () => {
    expect(markup(h(LoginForm))).toMatchSnapshot();
  });
});

// C1 de la 11.7c (D96; hallazgo 7 de la 11.3b): el menu lateral se ensanchaba con
// focus-within. Al elegir una opcion, el foco queda en ese enlace tras navegar, y el menu
// seguia en 256 px sobre la pagina con el raton en otra parte (visto en staging a 830 px): un
// clic en la franja izquierda del contenido abria otra seccion. Ahora se ensancha con el raton
// encima o con el foco del teclado (:focus-visible dentro), no con el foco que deja un clic.
// jsdom no calcula :focus-visible ni anchos, asi que esta prueba fija la regla en las clases;
// la prueba de comportamiento es el navegador a 830 px.
describe("menu lateral del shell", () => {
  const shell = () =>
    markup(h(DashboardShell, { session: session("ADMIN"), children: h("p", null, "Contenido") }));
  const aside = () => {
    const html = shell();
    return html.slice(html.indexOf("<aside"), html.indexOf("</aside>"));
  };
  const asideClasses = () => /<aside class="([^"]*)"/.exec(aside())?.[1].split(" ") ?? [];

  it("no se ensancha ni muestra sus etiquetas con cualquier foco dentro", () => {
    expect(aside()).not.toContain("focus-within");
  });

  it("se ensancha con el raton encima o con el foco del teclado", () => {
    expect(asideClasses()).toEqual(
      expect.arrayContaining([
        "md:hover:w-64",
        "md:has-[:focus-visible]:w-64",
        "md:has-[:focus-visible]:overflow-visible",
      ]),
    );
  });

  it("muestra sus etiquetas con el raton encima o con el foco del teclado", () => {
    const html = aside();

    expect(html).toContain("md:group-hover/sidebar:inline");
    expect(html).toContain("md:group-has-[:focus-visible]/sidebar:inline");
    expect(html).toContain("md:group-has-[:focus-visible]/sidebar:block");
  });
});
