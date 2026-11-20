import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LoadingState } from "@/components/ui/loading-state";
import { Skeleton } from "@/components/ui/skeleton";

// Carga (entrega 8). El HTML completo esta en primitives.test.ts; aqui se exige
// cada regla de accesibilidad y de movimiento por separado.

function render(node: ReactNode) {
  return renderToStaticMarkup(node);
}

describe("LoadingState", () => {
  it("se anuncia con role=status y su texto", () => {
    const html = render(h(LoadingState, { label: "Cargando materiales..." }));

    expect(html).toMatch(/^<div role="status"/);
    expect(html).toContain("<span>Cargando materiales...</span>");
  });

  it("sin texto dice Cargando...", () => {
    expect(render(h(LoadingState))).toContain("<span>Cargando...</span>");
  });

  it("su spinner es decorativo y se detiene con reduced motion", () => {
    const svg = render(h(LoadingState)).match(/<svg[^>]*>/)?.[0] ?? "";

    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain("motion-reduce:animate-none");
  });

  it("en una pantalla de esqueletos se oculta a la vista, no al lector", () => {
    const html = render(h(LoadingState, { variant: "inline", className: "sr-only" }));

    expect(html).toMatch(/^<div role="status"[^>]*class="[^"]*\bsr-only\b/);
    expect(html).not.toMatch(/^<div role="status"[^>]*aria-hidden/);
  });
});

describe("Skeleton", () => {
  it("es decorativo y usa las clases de production/loading.tsx", () => {
    const html = render(h(Skeleton, { className: "h-4 w-32" }));

    expect(html).toMatch(/^<div [^>]*aria-hidden="true"/);
    expect(html).toContain("animate-pulse rounded bg-muted");
  });

  it("detiene el pulso con reduced motion", () => {
    expect(render(h(Skeleton))).toContain("motion-reduce:animate-none");
  });
});

// Diseno de mensajes y estados (2026-11-19): la carga en bloque es una tarjeta con borde continuo
// (no el discontinuo del vacio), radio de 14 px, spinner de 22 px y texto de 13 px; en linea, el
// spinner de 16 px y el mismo texto.
describe("LoadingState con el diseno de mensajes y estados", () => {
  function classesOfStatus(html: string) {
    return (/^<div role="status"[^>]*class="([^"]*)"/.exec(html)?.[1] ?? "").split(" ");
  }

  it("en bloque: tarjeta con borde continuo, radio de 14 px y texto de 13 px", () => {
    const clases = classesOfStatus(render(h(LoadingState)));

    expect(clases).toEqual(expect.arrayContaining(["rounded-xl", "border", "border-border", "bg-card", "text-[0.8125rem]"]));
    expect(clases).not.toContain("border-dashed");
  });

  it("en bloque el spinner mide 22 px; en linea, 16 px", () => {
    expect(render(h(LoadingState)).match(/<svg[^>]*>/)?.[0]).toContain("size-[22px]");
    expect(render(h(LoadingState, { variant: "inline" })).match(/<svg[^>]*>/)?.[0]).toContain("size-4");
    expect(classesOfStatus(render(h(LoadingState, { variant: "inline" })))).toContain("text-[0.8125rem]");
  });
});
