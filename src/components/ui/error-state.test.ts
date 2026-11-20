import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchX } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

// Pantalla de error (propuesta de mensajes y estados, 2026-11-19, D137): la escena del robot
// que suelda el monitor, con capas de animacion en bucle encima de la imagen quieta. Es
// decorativa: el titulo y el texto dicen que paso. Sin boton de pausa (decision del
// responsable, anotada como riesgo de WCAG 2.2.2); con reducir movimiento todo queda quieto.

const completo = renderToStaticMarkup(
  h(ErrorState, {
    title: "No se pudo cargar la informacion",
    description: "Intenta de nuevo en unos segundos.",
    detail: "Codigo de referencia: 123",
    actions: h(Button, null, "Reintentar"),
  }),
);
const BRAND = readFileSync("src/styles/brand.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const CAPAS = ["scan", "flicker", "glow", "spark", "particle", "smoke", "alert", "led", "visor"];

describe("ErrorState", () => {
  it("la escena es decorativa: imagen sin texto alternativo dentro de un bloque oculto al lector", () => {
    expect(completo).toMatch(/<div[^>]*aria-hidden="true"[^>]*data-slot="error-scene"|<div[^>]*data-slot="error-scene"[^>]*aria-hidden="true"/);
    expect(completo).toMatch(/<img[^>]*alt=""[^>]*robot-error\.webp|<img[^>]*robot-error\.webp[^>]*alt=""/);
  });

  it("dibuja cada capa de animacion sobre la imagen", () => {
    for (const capa of CAPAS) {
      expect(completo).toContain(`error-scene-${capa}`);
    }
  });

  it("el icono va en un circulo granate sobre la escena, y la pagina puede cambiarlo", () => {
    expect(completo).toMatch(/data-slot="error-scene-icon"[^>]*class="[^"]*bg-destructive-surface[^"]*"[\s\S]*?lucide-triangle-alert/);
    expect(renderToStaticMarkup(h(ErrorState, { title: "No encontrado", icon: SearchX }))).toMatch(/lucide-search-x/);
  });

  it("titulo de 18 px en seminegrita, todavia el h1 de la pagina", () => {
    expect(completo).toMatch(/<h1 class="[^"]*\btext-lg\b[^"]*\bfont-semibold\b[^"]*">No se pudo cargar la informacion<\/h1>/);
  });

  it("el detalle tecnico es plegable y va en letra monoespaciada", () => {
    expect(completo).toMatch(/<details[^>]*>[\s\S]*<summary[^>]*>Detalle técnico<\/summary>[\s\S]*<p class="[^"]*\bfont-mono\b[^"]*">Codigo de referencia: 123<\/p>[\s\S]*<\/details>/);
  });

  it("las acciones de la pagina siguen debajo", () => {
    expect(completo).toMatch(/<\/details>[\s\S]*Reintentar/);
  });
});

describe("animaciones de la escena (brand.css)", () => {
  it("cada capa tiene su animacion en bucle", () => {
    for (const capa of ["float", ...CAPAS]) {
      expect(BRAND).toMatch(new RegExp(`@keyframes error-scene-${capa}\\b`));
    }
  });

  it("con reducir movimiento ninguna capa se anima", () => {
    const reducido = BRAND.slice(BRAND.lastIndexOf("prefers-reduced-motion"));

    for (const capa of ["float", ...CAPAS]) {
      expect(reducido).toContain(`.error-scene-${capa}`);
    }
    expect(reducido).toMatch(/animation:\s*none/);
  });

  it("nada parpadea mas de 3 veces por segundo: el LED dura al menos 1 s por ciclo (WCAG 2.3.1)", () => {
    expect(BRAND).toMatch(/\.error-scene-led\s*\{[^}]*animation:[^;]*var\(--motion-blink\)/);
  });
});
