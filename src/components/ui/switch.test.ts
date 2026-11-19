import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Switch } from "@/components/ui/switch";

// Interruptor (propuesta del responsable, 2026-11-19): pista de 44 x 24 px con borde de acero;
// encendido en verde forja, porque el naranja queda solo para la accion principal; pulgar
// claro de 18 px con sombra; foco con el anillo y el hueco de los botones; transicion que se
// asienta suave y ninguna con reducir movimiento.

function classesOf(html: string, slot: string) {
  return (new RegExp(`data-slot="${slot}"[^>]*class="([^"]*)"|class="([^"]*)"[^>]*data-slot="${slot}"`).exec(html)
    ?.slice(1)
    .find(Boolean) ?? "")
    .replaceAll("&amp;", "&")
    .split(" ");
}

const html = renderToStaticMarkup(h(Switch, { checked: true, "aria-label": "Activo" }));
const pista = classesOf(html, "switch");
const pulgar = classesOf(html, "switch-thumb");

describe("Switch", () => {
  it("pista de 44 x 24 px con borde de acero, verde forja al encenderse", () => {
    expect(pista).toEqual(
      expect.arrayContaining([
        "h-6",
        "w-11",
        "border-control-border",
        "data-[state=unchecked]:bg-muted",
        "data-[state=checked]:bg-accent-forge",
        "data-[state=checked]:border-accent-forge",
      ]),
    );
    // Sin el naranja de la accion principal. La expresion no escribe el nombre de una utilidad:
    // Tailwind generaria la clase a partir del texto de la prueba.
    expect(pista.filter((name) => /(bg|border)-primary$/.test(name))).toEqual([]);
  });

  it("foco con el anillo y el hueco de los botones", () => {
    expect(pista).toEqual(
      expect.arrayContaining([
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
        "focus-visible:ring-offset-background",
      ]),
    );
  });

  it("deshabilitado: borde comun y atenuado", () => {
    expect(pista).toEqual(
      expect.arrayContaining(["disabled:border-border", "disabled:opacity-55", "disabled:cursor-not-allowed"]),
    );
  });

  it("pulgar claro de 18 px con sombra, que recorre 20 px", () => {
    expect(pulgar).toEqual(
      expect.arrayContaining([
        "size-4.5",
        "bg-foreground",
        "shadow-thumb",
        "data-[state=unchecked]:translate-x-0.5",
        "data-[state=checked]:translate-x-5.5",
      ]),
    );
    expect(pulgar).not.toContain("data-[state=checked]:bg-primary-foreground");
  });

  it("la pista y el pulgar se asientan en --motion-base y no se mueven con reducir movimiento", () => {
    for (const clases of [pista, pulgar]) {
      expect(clases).toEqual(
        expect.arrayContaining(["duration-(--motion-base)", "ease-(--ease-settle)", "motion-reduce:transition-none"]),
      );
    }
  });

  // Es un <button role="switch">: sin excluirlo, la regla global de patterns.css le dibujaria su
  // contorno ademas del anillo propio, como pasaba con los botones.
  it("la regla global del contorno de foco no alcanza al interruptor", () => {
    const patterns = readFileSync("src/styles/patterns.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selector = /([^{}]*):focus-visible\s*\{\s*outline:\s*2px solid/.exec(patterns)?.[1].trim() ?? "";

    expect(selector).toMatch(/:where\(:not\([^)]*\[data-slot="switch"\][^)]*\)\)/);
  });
});
