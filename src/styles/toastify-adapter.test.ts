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
      ["--toastify-color-progress-success", "var(--success)"],
      ["--toastify-color-progress-error", "var(--destructive-outline)"],
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

// Avisos con la propuesta «Estados (mensajes temporales)» del responsable (2026-11-20). En staging
// el icono quedaba centrado contra el bloque de texto (entre el titulo y la descripcion), pegado al
// texto, y la X iba posicionada encima del aviso: las reglas del cuerpo apuntaban a
// .Toastify__toast-body, que toastify 11 ya no crea. Ahora el aviso mismo es la fila: insignia de
// 28 px con el color del tipo, texto y X, alineados arriba; barra de 3 px sobre un riel gris.
describe("avisos con la propuesta de mensajes temporales", () => {
  it("no quedan reglas para .Toastify__toast-body, que toastify 11 no crea", () => {
    expect(ADAPTER).not.toContain("Toastify__toast-body");
  });

  it("el aviso mide 360 px con relleno 14 16 17 y es una fila alineada arriba con 12 px entre piezas", () => {
    const variables = declaracionesDe(".Toastify");
    const aviso = declaracionesDe(".Toastify .Toastify__toast");

    expect(variables).toMatch(/--toastify-toast-width:\s*360px/);
    expect(variables).toMatch(/--toastify-toast-padding:\s*14px 16px 17px/);
    expect(aviso).toMatch(/align-items:\s*flex-start/);
    expect(aviso).toMatch(/gap:\s*12px/);
    expect(aviso).toMatch(/overflow:\s*hidden/);
  });

  it("el icono es una insignia redonda de 28 px con el color de cada tipo", () => {
    const insignia = declaracionesDe(".Toastify .Toastify__toast-icon");

    expect(insignia).toMatch(/width:\s*28px/);
    expect(insignia).toMatch(/height:\s*28px/);
    expect(insignia).toMatch(/border-radius:\s*999px/);
    expect(insignia).toMatch(/color:\s*var\(--foreground\)/);
    expect(insignia).toMatch(/margin:\s*0/);
    for (const [tipo, color] of [
      ["success", "--success"],
      ["error", "--destructive-outline"],
      ["warning", "--warning"],
      ["info", "--info"],
    ] as const) {
      expect(declaracionesDe(`.Toastify .Toastify__toast--${tipo} .Toastify__toast-icon`)).toMatch(
        new RegExp(`background-color:\\s*var\\(${color}\\)`),
      );
    }
    expect(declaracionesDe(".Toastify .Toastify__toast-icon svg")).toMatch(/width:\s*15px/);
  });

  it("la X es una pieza de la fila, arriba, y no se posiciona encima del texto", () => {
    const cerrar = declaracionesDe(".Toastify .Toastify__close-button");

    expect(cerrar).toMatch(/position:\s*static/);
    expect(cerrar).toMatch(/align-self:\s*flex-start/);
    expect(cerrar).toMatch(/flex-shrink:\s*0/);
  });

  it("la barra mide 3 px, va opaca y corre sobre un riel gris", () => {
    expect(declaracionesDe(".Toastify .Toastify__progress-bar--wrp")).toMatch(/height:\s*3px/);
    expect(declaracionesDe(".Toastify .Toastify__progress-bar")).toMatch(/opacity:\s*1/);
    const riel = declaracionesDe(".Toastify .Toastify__progress-bar--bg");
    expect(riel).toMatch(/background:\s*var\(--border\)/);
    expect(riel).toMatch(/opacity:\s*1/);
  });
});

// Posicion de la propuesta: abajo a la derecha, a 24 px de los bordes y 10 px entre avisos
// (toastify usa 16 px y 1rem). El margen va arriba de cada aviso: el mas nuevo queda pegado a los
// 24 px de la esquina, y al retirarse toastify anima ese margen a 0 sin saltos.
describe("avisos abajo a la derecha", () => {
  it("se separan 24 px de los bordes y 10 px entre si", () => {
    expect(declaracionesDe(".Toastify")).toMatch(/--toastify-toast-offset:\s*24px/);
    const aviso = declaracionesDe(".Toastify .Toastify__toast");
    expect(aviso).toMatch(/margin-top:\s*10px/);
    expect(aviso).toMatch(/margin-bottom:\s*0/);
  });
});
