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
vi.mock("sweetalert2", async () =>
  (await import("@/testing/notification-doubles")).sweetAlertModuleMock(),
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
