import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StateBadge } from "@/components/commercial/status-badge";

// Diseno de la presentacion (propuesta del responsable, 2026-11-20; D155). Cada estado comercial
// tiene un tono (data-tone), un gesto que ocurre una sola vez al montar (D153) y un punto de
// color que deja ver, sin leer, que tan avanzado va. El unico movimiento continuo es el doble
// pulso de radar del punto de «En producción». Los estados que la propuesta no dibuja siguen a
// su familia: emitido como pagada, anulada y cancelado como anulado, aprobado y aceptada como
// registrado; «Sin proforma» y «Sin comprobante» como pendiente, porque son un paso que falta.
// Se comprueban data-tone y data-variant, no clases de color: un nombre de utilidad escrito en
// una prueba llega al CSS de produccion.

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
  // estado, tono, variante de Badge, gesto, punto
  ["registrado", "info", "info", "badge-settle", "plain"],
  ["aprobado", "info", "info", "badge-settle", "plain"],
  ["aceptada", "info", "info", "badge-settle", "plain"],
  ["vigente", "neutral", "outline", null, "state-dot-steady"],
  ["pagada", "success", "success", "badge-settle", "plain"],
  ["emitido", "success", "success", "badge-settle", "plain"],
  ["entregado", "success", "success", "badge-pop", "plain"],
  ["pendiente", "warning", "warning", null, "plain"],
  ["sin-proforma", "warning", "warning", null, "plain"],
  ["sin-comprobante", "warning", "warning", null, "plain"],
  ["parcial", "warning", "warning", null, "plain"],
  ["en_produccion", "info", "info", null, "state-dot-live"],
  ["anulado", "destructive", "destructive", "badge-stamp", "plain"],
  ["anulada", "destructive", "destructive", "badge-stamp", "plain"],
  ["cancelado", "destructive", "destructive", "badge-stamp", "plain"],
] as const;

const GESTURES = ["badge-settle", "badge-pop", "badge-shake", "badge-stamp"];

describe("StateBadge", () => {
  for (const [status, tone, variant, gesture, dotKind] of EXPECTED) {
    it(`${status}: tono ${tone}, ${gesture ?? "sin gesto"} y su punto`, () => {
      const html = render(status);
      const actual = classes(html);

      expect(attribute(html, "data-tone")).toBe(tone);
      expect(attribute(html, "data-variant")).toBe(variant);
      expect(actual.filter((name) => GESTURES.includes(name))).toEqual(gesture ? [gesture] : []);

      const marker = dot(html);
      expect(marker).toContain('aria-hidden="true"');
      for (const kind of ["state-dot-steady", "state-dot-live"]) {
        expect(marker?.includes(kind)).toBe(kind === dotKind);
      }
    });
  }

  it("parcial se distingue de pendiente con un relleno a medias", () => {
    expect(classes(render("parcial"))).toContain("state-badge-partial");
    expect(classes(render("pendiente"))).not.toContain("state-badge-partial");
  });

  it("un estado desconocido se muestra tal cual, con borde discontinuo y sin punto ni gesto", () => {
    const html = render("en_revision");
    const actual = classes(html);

    expect(attribute(html, "data-tone")).toBe("unknown");
    expect(attribute(html, "data-variant")).toBe("outline");
    expect(actual).toContain("border-dashed");
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

  it("el pulso de radar no se recorta: la etiqueta deja ver lo que sale de su borde", () => {
    expect(classes(render("en_produccion"))).toContain("overflow-visible");
  });
});

describe("gestos y puntos en patterns.css", () => {
  const patterns = readFileSync("src/styles/patterns.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  function rule(selector: string) {
    // Los espacios del selector valen cualquier espacio: el archivo puede tener finales CRLF.
    const pattern = selector.replace(/[.:]/g, "\\$&").replace(/\s+/g, "\\s+");
    return patterns.match(new RegExp(`${pattern}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  }

  it("el pop y el golpe de sello ocurren una vez", () => {
    expect(rule(".badge-pop")).toMatch(/animation:\s*badge-pop\b/);
    expect(rule(".badge-stamp")).toMatch(/badge-stamp\b[^,]*,\s*badge-ring\b/);
    expect(`${rule(".badge-pop")}${rule(".badge-stamp")}`).not.toContain("infinite");
  });

  it("solo el punto de «En producción» late sin parar, con dos anillos desfasados", () => {
    expect(rule(".state-dot-live::before,\n  .state-dot-live::after")).toMatch(/state-ping[^;]*infinite/);
    expect(rule(".state-dot-live::before")).toMatch(/animation-delay:\s*0?\.9s/);
    expect(patterns.match(/infinite/g)).toHaveLength(1);
  });

  it("el punto de vigente brilla fijo y parcial tiene su relleno", () => {
    expect(rule(".state-dot-steady")).toMatch(/box-shadow:/);
    expect(rule(".state-dot-steady")).not.toContain("animation");
    expect(rule(".state-badge-partial")).toMatch(/background-image:\s*linear-gradient/);
  });

  it("con reducir movimiento no hay gestos y los anillos quedan quietos y tenues", () => {
    expect(patterns).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.badge-settle,\s*\.badge-shake,\s*\.badge-pop,\s*\.badge-stamp,\s*\.state-dot-live::before,\s*\.state-dot-live::after\s*\{\s*animation:\s*none;/,
    );
  });
});
