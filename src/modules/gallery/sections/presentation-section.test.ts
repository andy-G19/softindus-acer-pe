import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PresentationSection } from "@/modules/gallery/sections/presentation-section";

// Presentacion con la propuesta del responsable (2026-11-20; D153 a D158). La galeria muestra
// cada pieza en sus estados con datos ficticios: las nueve variantes de Badge, todos los estados
// de StateBadge mas uno desconocido, las tres tarjetas, los cuatro indicadores de la propuesta
// (tres con minigrafico, uno de ellos con enlace e icono, y el dial), los cuatro accesos a modulo numerados
// y los dos separadores. Los gestos ocurren una sola vez al montar, asi que cada fila de
// etiquetas tiene un boton que la vuelve a montar para repetirlos.

const html = renderToStaticMarkup(h(PresentationSection)).replaceAll("&quot;", '"');

function captions() {
  return [...html.matchAll(/<figcaption[^>]*>([^<]*)<\/figcaption>/g)].map((match) => match[1]);
}

function figure(caption: string) {
  const start = html.indexOf(`>${caption}</figcaption>`);
  return start === -1 ? "" : html.slice(start, html.indexOf("</figure>", start));
}

function count(text: string, pattern: RegExp) {
  return text.match(pattern)?.length ?? 0;
}

describe("Presentación", () => {
  it("muestra las familias en el orden de la propuesta", () => {
    expect(captions()).toEqual([
      "Etiqueta (Badge) en cada variante",
      "Etiqueta de estado (StateBadge)",
      "Tarjeta completa",
      "Tarjeta con barra térmica",
      "Tarjeta pequeña",
      "Indicadores (KpiCard)",
      "Acceso a módulo (ModuleAccessCard)",
      "Separadores",
    ]);
  });

  it("las nueve variantes de Badge", () => {
    const variants = [...figure("Etiqueta (Badge) en cada variante").matchAll(/data-slot="badge" data-variant="([a-z]+)"/g)].map(
      (match) => match[1],
    );

    expect(variants).toEqual([
      "default",
      "success",
      "warning",
      "info",
      "secondary",
      "destructive",
      "outline",
      "ghost",
      "link",
    ]);
  });

  it("todos los tonos de StateBadge, con un estado desconocido al final", () => {
    const tones = [...figure("Etiqueta de estado (StateBadge)").matchAll(/data-tone="([a-z]+)"/g)].map((match) => match[1]);

    expect(new Set(tones)).toEqual(new Set(["info", "neutral", "success", "warning", "destructive", "unknown"]));
    expect(tones.at(-1)).toBe("unknown");
    expect(figure("Etiqueta de estado (StateBadge)")).toContain(">En producción<");
    expect(figure("Etiqueta de estado (StateBadge)")).toContain(">Sin proforma<");
  });

  it("cada fila de etiquetas tiene un boton para repetir sus gestos, que no envia nada", () => {
    for (const caption of ["Etiqueta (Badge) en cada variante", "Etiqueta de estado (StateBadge)"]) {
      const replay = figure(caption).match(/<button [^>]*>(?:(?!<\/button>)[\s\S])*<\/button>/)?.[0] ?? "";
      expect(replay).toContain('type="button"');
      expect(replay).toContain("Repetir gestos</button>");
    }
    expect(html).not.toContain("<form");
  });

  it("la tarjeta con barra termica usa el barrido", () => {
    expect(figure("Tarjeta con barra térmica")).toMatch(/class="heat-sweep heat-sweep-thin/);
  });

  it("los cuatro indicadores de la propuesta: tres con minigrafico, el dial y uno con enlace e icono", () => {
    const kpis = figure("Indicadores (KpiCard)");

    expect(count(kpis, /class="[^"]*\bkpi-card\b/g)).toBe(4);
    expect(count(kpis, /data-slot="kpi-bars"/g)).toBe(3);
    expect(count(kpis, /data-slot="kpi-gauge"/g)).toBe(1);
    expect(count(kpis, /<line /g)).toBe(16);
    expect(kpis).toContain('aria-label="Pedidos de los últimos 6 días: Día 1 7, Día 2 9, Día 3 11, Día 4 10, Día 5 11, Hoy 12"');
    expect(kpis).toMatch(/data-slot="kpi-delta"[^>]*data-positive="true"[^>]*>\+16,9 %</);
    expect(count(kpis, /<a /g)).toBe(1);
    expect(kpis).toContain('data-slot="kpi-icon"');
    expect(count(kpis, /data-slot="kpi-bar-separator"/g)).toBe(1);
  });

  it("los cuatro accesos a modulo numerados, con el generico al final", () => {
    const modules = figure("Acceso a módulo (ModuleAccessCard)");
    const numbers = [...modules.matchAll(/data-slot="module-number"[^>]*>(\d+)</g)].map((match) => match[1]);

    expect(numbers).toEqual(["01", "02", "03", "04"]);
    expect(modules).toContain("lucide-circle");
  });

  it("los dos separadores", () => {
    const separators = figure("Separadores");

    expect(separators).toContain('data-orientation="horizontal"');
    expect(separators).toContain('data-orientation="vertical"');
  });
});
