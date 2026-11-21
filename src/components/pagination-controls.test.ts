import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaginationControls } from "@/components/pagination-controls";
import { getPaginationMeta } from "@/lib/pagination";

// Diseno de listados y navegacion (propuesta del responsable, 2026-11-21; D171). «Anterior» lleva
// una flecha a la izquierda y «Siguiente» una a la derecha, como en la maqueta; las flechas son
// decorativas, asi que el lector de pantalla solo lee el texto. Con enlace o deshabilitado, igual.

function render(page: number) {
  return renderToStaticMarkup(
    h(PaginationControls, {
      meta: getPaginationMeta({ totalItems: 45, page, pageSize: 20 }),
      basePath: "/dashboard/commercial/clients",
      searchParams: {},
    }),
  );
}

function control(html: string, label: string) {
  return html.match(new RegExp(`<(a|button) [^>]*>(?:(?!</(?:a|button)>)[\\s\\S])*${label}(?:(?!</(?:a|button)>)[\\s\\S])*</(?:a|button)>`))?.[0] ?? "";
}

describe("paginacion", () => {
  for (const [page, state] of [
    [2, "con enlace"],
    [1, "primera pagina"],
    [3, "ultima pagina"],
  ] as const) {
    it(`Anterior con flecha a la izquierda y Siguiente a la derecha (${state})`, () => {
      const html = render(page);
      const previous = control(html, "Anterior");
      const next = control(html, "Siguiente");

      expect(previous).toMatch(/<svg [^>]*lucide-arrow-left[^>]*>[\s\S]*<\/svg>Anterior</);
      expect(previous).toMatch(/<svg [^>]*data-icon="inline-start"/);
      expect(next).toMatch(/>Siguiente<svg [^>]*lucide-arrow-right/);
      expect(next).toMatch(/<svg [^>]*data-icon="inline-end"/);

      for (const svg of html.match(/<svg [^>]*>/g) ?? []) {
        expect(svg).toContain('aria-hidden="true"');
      }
    });
  }

  it("los enlaces siguen siendo enlaces y los extremos, botones deshabilitados", () => {
    expect(control(render(2), "Anterior")).toMatch(/^<a [^>]*href="\/dashboard\/commercial\/clients\?page=1"/);
    expect(control(render(1), "Anterior")).toMatch(/^<button [^>]*disabled=""/);
    expect(control(render(3), "Siguiente")).toMatch(/^<button [^>]*disabled=""/);
  });
});
