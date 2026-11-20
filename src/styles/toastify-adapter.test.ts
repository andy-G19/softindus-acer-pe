import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Adaptador de los avisos (react-toastify) al diseno de mensajes y estados (2026-11-19).
//
// El CSS base de toastify se importa desde JavaScript y queda fuera de toda capa: una regla sin
// capa gana a cualquiera dentro de @layer, sin importar especificidad ni orden. Con el adaptador
// en @layer utilities, casi nada se aplicaba (en staging: el fondo #121212, el radio de 6 px, la
// sombra, el icono y la barra verdes de toastify; solo el color del borde era nuestro). Ahora:
// - los colores, medidas y sombra van como variables de toastify declaradas en .Toastify (el
//   contenedor): los avisos las heredan de el y ganan a las de :root, con o sin capa;
// - lo que toastify pinta como propiedad directa va fuera de capa y con selectores prefijados por
//   .Toastify, para superar su especificidad (0-1-0).

const ADAPTER = readFileSync("src/styles/adapters/toastify.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const PROVIDER = readFileSync("src/components/notifications/notification-provider.tsx", "utf8");

function declaracionesDe(selector: string) {
  const inicio = ADAPTER.indexOf(`${selector} {`);
  return inicio === -1 ? "" : ADAPTER.slice(inicio, ADAPTER.indexOf("}", inicio));
}

describe("adaptador de toastify", () => {
  it("va fuera de toda capa, como el CSS base de toastify", () => {
    expect(ADAPTER).not.toMatch(/@layer/);
  });

  it("cada regla va dentro de .Toastify, para ganar a las de toastify", () => {
    const selectores = [...ADAPTER.matchAll(/([^{}@]+)\{/g)]
      .map((match) => match[1].trim())
      // Fuera: los pasos de @keyframes y los preludios de @media/@keyframes (la expresion corta en @).
      .filter((selector) => !/^(from|to|\d+%)$/.test(selector) && !/^(media|keyframes)\b/.test(selector));

    expect(selectores.length).toBeGreaterThan(0);
    expect(selectores.filter((selector) => !selector.split(",").every((parte) => parte.trim().startsWith(".Toastify")))).toEqual([]);
  });

  it("las variables de toastify apuntan a los tokens del diseno", () => {
    const variables = declaracionesDe(".Toastify");

    for (const [variable, valor] of [
      ["--toastify-color-dark", "var(--card)"],
      ["--toastify-text-color-dark", "var(--foreground)"],
      ["--toastify-toast-bd-radius", "var(--radius-lg)"],
      ["--toastify-toast-shadow", "var(--shadow-toast)"],
      ["--toastify-font-family", "var(--font-sans)"],
      ["--toastify-icon-color-success", "var(--success-foreground)"],
      ["--toastify-icon-color-error", "var(--destructive-foreground)"],
      ["--toastify-icon-color-warning", "var(--warning-foreground)"],
      ["--toastify-icon-color-info", "var(--info-foreground)"],
      ["--toastify-color-progress-success", "var(--success)"],
      ["--toastify-color-progress-error", "var(--destructive)"],
      ["--toastify-color-progress-warning", "var(--warning)"],
      ["--toastify-color-progress-info", "var(--info)"],
    ] as const) {
      expect(variables).toMatch(new RegExp(`${variable}:[^;]*${valor.replace(/[()]/g, "\\$&")}`));
    }
  });

  it("la tarjeta lleva la textura y el borde de acero", () => {
    expect(declaracionesDe(".Toastify")).toMatch(/--toastify-color-dark:[^;]*var\(--texture-metal\)/);
    expect(declaracionesDe(".Toastify .Toastify__toast")).toMatch(/border:[^;]*var\(--control-border\)/);
  });

  it("entra con la animacion propia, y con reducir movimiento dura 1 ms en lugar de quitarse", () => {
    // Toastify espera el animationend para retirar el aviso: con animation: none no llegaria.
    expect(PROVIDER).toMatch(/cssTransition\(\{[^}]*enter:\s*"toast-industrial-enter"[^}]*exit:\s*"toast-industrial-exit"/);
    expect(ADAPTER).toMatch(/@keyframes toast-industrial-enter/);
    expect(ADAPTER).toMatch(/@keyframes toast-industrial-exit/);
    const reducido = ADAPTER.slice(ADAPTER.indexOf("prefers-reduced-motion"));
    expect(reducido).toMatch(/animation-duration:\s*1ms/);
    expect(reducido).not.toMatch(/animation:\s*none/);
  });
});
