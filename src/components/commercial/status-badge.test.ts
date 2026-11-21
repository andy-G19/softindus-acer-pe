import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StateBadge } from "@/components/commercial/status-badge";

// Diseno de listados y navegacion (propuesta del responsable, 2026-11-21; D170). La etiqueta de
// estado es simple y documental: 22 px de alto, letra de 10,5 px, 9 px a los lados y un punto de
// 5,5 px del color del texto, sin brillo. Cada estado tiene solo un tono (data-tone): sin gestos al
// montar, sin el radar de «En producción», que pasa a ambar con el punto fijo, y sin el relleno a
// medias de parcial. Reemplaza esa parte de D155; con esto ninguna etiqueta tiene un bucle (D153).
// Los estados que la propuesta no dibuja siguen a su familia: emitido como pagada, anulada y
// cancelado como anulado, aprobado y aceptada como registrado; «Sin proforma» y «Sin comprobante»
// como pendiente, porque son un paso que falta. Se comprueban data-tone y data-variant, no clases
// de color: un nombre de utilidad escrito en una prueba llega al CSS de produccion.

function render(status: string | null | undefined) {
  return renderToStaticMarkup(h(StateBadge, { status }));
}

function attribute(html: string, name: string) {
  return html.match(new RegExp(`^<span [^>]*${name}="([^"]*)"`))?.[1];
}

function classes(html: string) {
  return (attribute(html, "class") ?? "").split(" ");
}

function dot(html: string) {
  return html.match(/<span [^>]*data-slot="state-dot"[^>]*>/)?.[0];
}

const EXPECTED = [
  // estado, tono, variante de Badge
  ["registrado", "info", "info"],
  ["aprobado", "info", "info"],
  ["aceptada", "info", "info"],
  ["vigente", "neutral", "outline"],
  ["pagada", "success", "success"],
  ["emitido", "success", "success"],
  ["entregado", "success", "success"],
  ["pendiente", "warning", "warning"],
  ["sin-proforma", "warning", "warning"],
  ["sin-comprobante", "warning", "warning"],
  ["parcial", "warning", "warning"],
  ["en_produccion", "warning", "warning"],
  ["anulado", "destructive", "destructive"],
  ["anulada", "destructive", "destructive"],
  ["cancelado", "destructive", "destructive"],
] as const;

const GESTURES = ["badge-settle", "badge-pop", "badge-shake", "badge-stamp"];
const RETIRED = ["state-dot-steady", "state-dot-live", "state-badge-partial"];

describe("StateBadge", () => {
  for (const [status, tone, variant] of EXPECTED) {
    it(`${status}: tono ${tone}, sin gesto y con su punto fijo`, () => {
      const html = render(status);
      const actual = classes(html);

      expect(attribute(html, "data-tone")).toBe(tone);
      expect(attribute(html, "data-variant")).toBe(variant);
      expect(actual.filter((name) => GESTURES.includes(name) || RETIRED.includes(name))).toEqual([]);

      const marker = dot(html) ?? "";
      expect(marker).toContain('aria-hidden="true"');
      expect(marker).toContain("size-[5.5px]");
      expect(RETIRED.some((name) => marker.includes(name))).toBe(false);
    });
  }

  it("22 px de alto, letra de 10,5 px y 9 px a los lados", () => {
    expect(classes(render("pagada"))).toEqual(
      expect.arrayContaining(["h-[22px]", "px-[9px]", "text-[10.5px]", "gap-1.5"]),
    );
  });

  it("en producción ya no se sale de su borde: la etiqueta recorta su contenido como las demas", () => {
    // La clase la usa tambien el shell, asi que nombrarla aqui no agrega nada al CSS.
    expect(classes(render("en_produccion"))).not.toContain("overflow-visible");
    expect(classes(render("en_produccion"))).toContain("overflow-hidden");
  });

  it("un estado desconocido se muestra tal cual, con borde discontinuo y sin punto ni gesto", () => {
    const html = render("en_revision");
    const actual = classes(html);

    expect(attribute(html, "data-tone")).toBe("unknown");
    expect(attribute(html, "data-variant")).toBe("outline");
    expect(actual).toEqual(expect.arrayContaining(["border-dashed", "h-[22px]", "px-[9px]", "text-[10.5px]"]));
    expect(actual.filter((name) => GESTURES.includes(name))).toEqual([]);
    expect(dot(html)).toBeUndefined();
    expect(html).toContain(">en_revision<");
  });

  it("sin estado muestra un guion como desconocido", () => {
    const html = render(null);

    expect(attribute(html, "data-tone")).toBe("unknown");
    expect(html).toContain(">-<");
  });

  it("solo cuentan los estados de la tabla: constructor no toma una propiedad de Object", () => {
    expect(attribute(render("constructor"), "data-tone")).toBe("unknown");
  });
});

describe("gestos y puntos en patterns.css", () => {
  const patterns = readFileSync("src/styles/patterns.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  it("el radar, el brillo fijo y el relleno a medias se retiraron", () => {
    for (const name of [...RETIRED, "state-ping"]) {
      expect(patterns).not.toContain(name);
    }
  });

  it("ninguna regla de etiquetas o estados tiene un bucle", () => {
    // Otras familias tienen los suyos (el acceso a modulo, D158).
    const loops = [...patterns.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter((match) => match[2].includes("infinite"))
      .map((match) => match[1].trim().replace(/\s+/g, " "))
      .filter((selector) => /badge|state/.test(selector));
    expect(loops).toEqual([]);
  });

  it("con reducir movimiento no hay gestos", () => {
    expect(patterns).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.badge-settle,\s*\.badge-shake,\s*\.badge-pop,\s*\.badge-stamp\s*\{\s*animation:\s*none;\s*\}/,
    );
  });
});
