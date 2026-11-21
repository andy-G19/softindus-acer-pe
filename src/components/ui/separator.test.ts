import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Separator } from "@/components/ui/separator";

// Diseno de la presentacion (propuesta del responsable, 2026-11-20; D158). Hasta el separador
// mas neutro esta encendido: un destello de acero recorre la linea horizontal cada 4,5 s y la
// vertical late entre el borde comun y el acero claro cada 3 s. D158 eligio la maqueta, una
// excepcion a la quietud en reposo (D153); se detiene con reducir movimiento.

function classes(orientation: "horizontal" | "vertical") {
  return (renderToStaticMarkup(h(Separator, { orientation })).match(/class="([^"]*)"/)?.[1] ?? "").split(" ");
}

const patterns = readFileSync("src/styles/patterns.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function rule(selector: string) {
  const pattern = selector.replace(/[.:()\[\]="]/g, "\\$&").replace(/\s+/g, "\\s+");
  return patterns.match(new RegExp(`(?:^|\\n)\\s*${pattern}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

// La curva se arma por partes: escrita entera en una prueba, Tailwind genera su utilidad.
const curve = ["ease", "in", "out"].join("-");

describe("Separator", () => {
  it("las dos orientaciones llevan el destello y recortan lo que sale de la linea", () => {
    for (const orientation of ["horizontal", "vertical"] as const) {
      expect(classes(orientation)).toEqual(expect.arrayContaining(["separator-gleam", "relative", "overflow-hidden"]));
    }
  });

  it("la horizontal: un destello de acero del 30 % la recorre cada 4,5 s", () => {
    const gleam = rule('.separator-gleam[data-orientation="horizontal"]::after');

    expect(gleam).toMatch(/width:\s*30%/);
    expect(gleam).toMatch(/linear-gradient\(90deg, transparent, var\(--accent-steel\), transparent\)/);
    expect(gleam).toMatch(new RegExp(`animation:\\s*separator-travel 4\\.5s ${curve} infinite`));
  });

  it("la vertical late entre el borde comun y el acero claro cada 3 s", () => {
    expect(rule('.separator-gleam[data-orientation="vertical"]')).toMatch(
      new RegExp(`animation:\\s*separator-pulse 3s ${curve} infinite`),
    );
    const pasos = patterns.slice(patterns.indexOf("@keyframes separator-pulse"));
    expect(pasos).toMatch(/background-color:\s*var\(--border\)/);
    expect(pasos).toMatch(/background-color:\s*var\(--control-border-hover\)/);
  });

  it("con reducir movimiento queda quieto", () => {
    expect(patterns).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.separator-gleam,\s*\.separator-gleam::after\s*\{\s*animation:\s*none;/,
    );
  });
});
