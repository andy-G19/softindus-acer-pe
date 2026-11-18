import { readdirSync, readFileSync } from "node:fs";
import { createElement as h, type ReactNode } from "react";
import type { Session } from "next-auth";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DashboardShell } from "@/components/layout/dashboard-shell";

// C2 de la 11.7c (D98): el tema (`dark`, que activa las variantes dark: de shadcn, e
// `industrial-dark`, el ambito del adaptador) estaba en el div del shell y en el main del
// login. Radix pinta los dialogos y paneles en un portal hijo de body, fuera de ese div: no
// les llegaba el tema, y el mismo formulario se veia distinto en una pagina completa y en su
// panel (visto en staging: el campo con fondo y borde en la pagina, transparente en el panel).
// El tema pasa a <html>, que contiene todo, portales incluidos.

// Next da a cada fuente una clase con hash; un nombre como font-oswald lo fusionaria cn().
vi.mock("next/font/local", () => ({
  default: (options: { variable: string }) => ({ variable: `fuente_${options.variable.slice(2)}_abc123` }),
}));
vi.mock("@/components/notifications/notification-provider", () => ({
  NotificationProvider: () => null,
}));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useRouter: () => ({ back() {}, forward() {}, push() {}, replace() {}, refresh() {}, prefetch() {} }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/auth", () => ({ signOut: vi.fn(), signIn: vi.fn() }));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

const { default: RootLayout } = await import("./layout");

function clases(html: string, etiqueta: string) {
  return new RegExp(`<${etiqueta}[^>]*\\sclass="([^"]*)"`).exec(html)?.[1].split(" ") ?? [];
}

const session: Session = {
  user: { id: "USR00000001", name: "Ana Torres", email: "ana@acerosperu.test", role: "ADMIN", status: "activo" },
  expires: "2026-12-31T00:00:00.000Z",
};

describe("C2 de la 11.7c: el tema vive en <html>", () => {
  it("<html> lleva dark e industrial-dark, asi que los portales tambien los heredan", () => {
    const html = renderToStaticMarkup(h(RootLayout, null, h("p", null, "contenido")) as ReactNode);

    expect(clases(html, "html")).toEqual(expect.arrayContaining(["dark", "industrial-dark"]));
  });

  it("el shell ya no declara el tema por su cuenta", () => {
    const html = renderToStaticMarkup(h(DashboardShell, { session, children: h("p", null, "x") }));
    const primerDiv = clases(html, "div");

    expect(primerDiv).not.toContain("dark");
    expect(primerDiv).not.toContain("industrial-dark");
  });

  // El main del login llevaba el tema, asi que las reglas «main hN» no llegaban a su titulo. Con
  // el tema en <html> si llegarian: se filtran. Se leen todas las hojas, porque las reglas
  // salieron del adaptador a patterns.css (C6 de la 11.7c) y podrian volver a moverse.
  it("las reglas de titulos no alcanzan el titulo del login", () => {
    const hojas = readdirSync("src/styles", { recursive: true, encoding: "utf8" }).filter((f) =>
      f.endsWith(".css"),
    );
    const css = hojas.map((f) => readFileSync(`src/styles/${f}`, "utf8")).join("\n");
    const selectores = [...css.matchAll(/\.industrial-dark main[^,{]*/g)].map((m) => m[0]);

    expect(selectores.length).toBeGreaterThan(0);
    for (const selector of selectores) {
      expect(selector).toContain("main:where(:not(.login-industrial-bg))");
    }
  });
});
