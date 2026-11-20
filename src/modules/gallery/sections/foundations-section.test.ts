import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FoundationsSection } from "@/modules/gallery/sections/foundations-section";

// Fundamentos con la propuesta del responsable (2026-11-20). La galeria muestra los tokens reales
// de src/styles/tokens.css: los chips, las sombras y las capas leen sus variables, no valores
// copiados. Colores en cuatro grupos, Geist por tamano, Oswald en sus tres pesos declarados (sin el
// 650, que se dibujaba como 700), sombras reales, la cadena de capas y las dos barras de 6 s.

const html = renderToStaticMarkup(h(FoundationsSection)).replaceAll("&quot;", '"').replaceAll("&gt;", ">");
const TOKENS = readFileSync("src/styles/tokens.css", "utf8");

function captions() {
  return [...html.matchAll(/<figcaption[^>]*>([^<]*)<\/figcaption>/g)].map((match) => match[1]);
}

function chips(group: string) {
  const start = html.indexOf(`>${group}</figcaption>`);
  const end = html.indexOf("</figure>", start);
  return [...html.slice(start, end).matchAll(/data-token="(--[\w-]+)"/g)].map((match) => match[1]);
}

function tokenValue(name: string) {
  return TOKENS.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
}

describe("Fundamentos", () => {
  it("agrupa los colores por papel: accion y estado, marca, superficies y graficos", () => {
    expect(captions().slice(0, 4)).toEqual(["Acción y estado", "Marca", "Superficies y neutros", "Gráficos"]);
    expect(chips("Acción y estado")).toEqual([
      "--primary",
      "--ring",
      "--success",
      "--warning",
      "--info",
      "--destructive",
      "--destructive-foreground",
    ]);
    expect(chips("Marca")).toEqual(["--accent-forge", "--accent-ember", "--accent-steel", "--accent-copper", "--clear-foreground"]);
    expect(chips("Superficies y neutros")).toHaveLength(12);
    expect(chips("Gráficos")).toEqual(["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"]);
  });

  it("cada chip pinta su token real en un bloque de 52 px con borde de acero", () => {
    const chip = html.match(/<span[^>]*data-token="--primary"[^>]*>/)?.[0] ?? "";

    expect(chip).toContain("background:var(--primary)");
    expect(chip).toMatch(/class="[^"]*\bh-\[52px\][^"]*\bborder-control-border\b/);
    expect(chip).toContain('aria-hidden="true"');
  });

  it("Geist se muestra por tamano y Oswald en 500, 600 y 700, sin el 650", () => {
    expect(html).toContain("Texto (Geist)");
    for (const size of ["13px", "14px", "16px", "18px"]) {
      expect(html).toContain(`>${size}</span>`);
    }
    expect(captions()).toContain("Títulos (Oswald 500, 600 y 700)");
    expect(html).not.toContain("650");
  });

  // GallerySample trae flex-wrap. En un flex que puede envolver, cada linea mide lo que su elemento
  // mas ancho y no lo que el contenedor, asi que items-stretch estiraba cada fila al ancho del texto
  // de ejemplo y el truncate no recortaba: a 375 px la pagina media 750 de ancho (visto en staging;
  // aqui no hay navegador que calcule el diseno, por eso se fija la clase).
  it.each(["Texto (Geist)", "Títulos (Oswald 500, 600 y 700)"])("las filas de %s caben en el ancho: una sola linea", (label) => {
    const start = html.indexOf(`>${label}</figcaption>`);
    const contenedor = html.slice(start).match(/<div class="([^"]*)"/)?.[1].split(" ") ?? [];

    expect(contenedor).toContain("flex-nowrap");
    expect(contenedor).not.toContain("flex-wrap");
  });

  it("las sombras son las reales, una tarjeta por token", () => {
    const sombras = [...html.matchAll(/box-shadow:var\((--shadow-[\w-]+)\)/g)].map((match) => match[1]);

    expect(sombras).toEqual([
      "--shadow-raised",
      "--shadow-raised-hover",
      "--shadow-card-hover",
      "--shadow-panel",
      "--shadow-menu",
      "--shadow-sidebar",
      "--shadow-toast",
      "--shadow-dialog",
      "--shadow-hairline",
    ]);
  });

  it("las capas van en orden y con los valores de tokens.css", () => {
    const capas = [...html.matchAll(/data-layer="(--z-[\w-]+)"[^>]*>.*?<span[^>]*>([^<]+)<\/span><span[^>]*>(\d+)<\/span>/g)].map(
      (match) => [match[1], match[2], match[3]],
    );

    expect(capas).toEqual([
      ["--z-sidebar", "Barra lateral", tokenValue("--z-sidebar")],
      ["--z-header", "Cabecera", tokenValue("--z-header")],
      ["--z-overlay", "Ventanas", tokenValue("--z-overlay")],
    ]);
  });

  // Tailwind no avisa de una utilidad sin color en @theme: text-accent-ember no generaria nada.
  it("la cifra de cada capa va en brasa, con su color expuesto en @theme", () => {
    expect(html).toMatch(/<span class="[^"]*\btext-accent-ember\b[^"]*">30<\/span>/);
    expect(TOKENS).toMatch(/--color-accent-ember:\s*var\(--accent-ember\)/);
  });

  it("muestra la barra termica real y el barrido nuevo, decorativos", () => {
    expect(html).toMatch(/<div aria-hidden="true" class="heat-bar\b/);
    expect(html).toMatch(/<div aria-hidden="true" class="heat-sweep\b/);
  });

  it("los radios van de sm a 2xl sobre la tarjeta", () => {
    const radios = [...html.matchAll(/<span class="([^"]*\brounded-(?:sm|md|lg|xl|2xl)\b[^"]*)">([^<]+)<\/span>/g)].map(
      (match) => match[2],
    );

    expect(radios).toEqual(["rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl"]);
  });
});
