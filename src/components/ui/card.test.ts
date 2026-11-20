import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

// Diseno de la presentacion (propuesta del responsable, 2026-11-20; D156). La tarjeta es una placa
// de acero cepillado: fondo del color de la pagina con la textura de metal a 135 grados, borde
// comun y radio de 10 px. La textura se desplaza muy despacio (18 s por vuelta), una excepcion
// elegida a D153, y se detiene con reducir movimiento. Al pasar el puntero sube 2 px, aclara el
// borde y proyecta sombra. La barra termica es el barrido de .heat-sweep, a 3 px y sin redondeo.

function classesOf(html: string, slot: string) {
  return (html.match(new RegExp(`<div [^>]*data-slot="${slot}"[^>]*class="([^"]*)"`))?.[1] ?? "").split(" ");
}

function withoutComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function rule(css: string, selector: string) {
  const pattern = selector.replace(/[.:]/g, "\\$&").replace(/\s+/g, "\\s+");
  return css.match(new RegExp(`${pattern}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

const card = renderToStaticMarkup(h(Card, null, h(CardHeader, null, "Titulo"), h(CardContent, null, "Contenido")));

describe("placa de la tarjeta", () => {
  it("acero cepillado sobre el fondo de la pagina, con borde comun y radio de 10 px", () => {
    const actual = classesOf(card, "card");

    for (const name of [
      "rounded-lg",
      "border",
      "border-border",
      "bg-background",
      "bg-(image:--texture-metal)",
      "bg-[length:180px_180px]",
      "card-brushed",
    ]) {
      expect(actual).toContain(name);
    }
    expect(actual).not.toContain("ring-1");
    expect(actual).not.toContain("rounded-xl");
  });

  it("al pasar el puntero sube 2 px, aclara el borde y proyecta sombra; con reducir movimiento no sube", () => {
    const actual = classesOf(card, "card");

    for (const name of [
      "transition-[border-color,translate,box-shadow]",
      "duration-(--motion-base)",
      "hover:-translate-y-0.5",
      "hover:border-control-border-hover",
      "hover:shadow-card-lift",
      "motion-reduce:transition-none",
      "motion-reduce:translate-none!",
    ]) {
      expect(actual).toContain(name);
    }
  });

  it("la cabecera y el pie siguen el radio de la placa", () => {
    const html = renderToStaticMarkup(h(Card, null, h(CardHeader, null, "T"), h(CardFooter, null, "P")));

    expect(classesOf(html, "card-header")).toContain("rounded-t-lg");
    expect(classesOf(html, "card-footer")).toContain("rounded-b-lg");
  });
});

describe("barra termica de la tarjeta", () => {
  it("es el barrido termico a 3 px, decorativo", () => {
    const html = renderToStaticMarkup(h(Card, { heatBar: true }, h(CardContent, null, "Contenido")));
    const bar = html.match(/<div [^>]*class="([^"]*heat-sweep[^"]*)"[^>]*>/);

    expect(bar?.[1].split(" ")).toEqual(expect.arrayContaining(["heat-sweep", "heat-sweep-thin"]));
    expect(bar?.[0]).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/class="[^"]*\bheat-bar\b/);
  });

  it("el riel fino mide 3 px, no se redondea y usa el borde comun", () => {
    const brand = withoutComments(readFileSync("src/styles/brand.css", "utf8"));
    const thin = rule(brand, ".heat-sweep-thin");

    expect(thin).toMatch(/height:\s*3px/);
    expect(thin).toMatch(/border-radius:\s*0/);
    expect(thin).toMatch(/background-color:\s*var\(--border\)/);
    // Va despues de .heat-sweep: misma especificidad, gana el ultimo.
    expect(brand.indexOf(".heat-sweep-thin {")).toBeGreaterThan(brand.indexOf(".heat-sweep {"));
  });
});

describe("desplazamiento del cepillado", () => {
  const brand = withoutComments(readFileSync("src/styles/brand.css", "utf8"));

  it("recorre un mosaico de 180 px en 18 s, a velocidad constante", () => {
    expect(rule(brand, ".card-brushed")).toMatch(/animation:\s*card-brush-pan var\(--motion-brush\) linear infinite/);
    const pasos = brand.slice(brand.indexOf("@keyframes card-brush-pan"));
    expect(pasos).toMatch(/background-position:\s*0 0/);
    expect(pasos).toMatch(/background-position:\s*180px 180px/);
  });

  it("con reducir movimiento queda quieto", () => {
    const reducido = brand.slice(brand.indexOf("prefers-reduced-motion"));

    expect(reducido).toMatch(/\.card-brushed\s*\{\s*animation:\s*none/);
  });

  it("la duracion y la sombra viven en tokens.css", () => {
    const tokens = withoutComments(readFileSync("src/styles/tokens.css", "utf8"));

    expect(tokens).toMatch(/^\s*--motion-brush:\s*18s;/m);
    expect(tokens).toMatch(/^\s*--shadow-card-lift:\s*0 10px 22px rgba\(0, 0, 0, 0\.3\);/m);
    expect(tokens).toMatch(/^\s*--shadow-card-lift:\s*var\(--shadow-card-lift\);/m);
  });
});
