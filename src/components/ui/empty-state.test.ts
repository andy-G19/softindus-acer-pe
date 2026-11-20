import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Package } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

// Estado vacio (propuesta de mensajes y estados, 2026-11-19): borde discontinuo de acero y
// ningun fondo, porque el vacio no es un error. Con icono, titulo o accion: icono en un circulo
// de 44 px, titulo de 15 px en seminegrita y texto de 13 px. Solo con su texto: una linea de
// 13 px atenuada.

function classesOf(html: string, tag: string, index = 0) {
  return ([...html.matchAll(new RegExp(`<${tag}[^>]*class="([^"]*)"`, "g"))][index]?.[1] ?? "").split(" ");
}

const completo = renderToStaticMarkup(
  h(EmptyState, {
    label: "Todavia no hay materiales",
    description: "Registra el primero.",
    icon: Package,
    action: h(Button, { size: "sm" }, "Nuevo material"),
  }),
);
const simple = renderToStaticMarkup(h(EmptyState, { label: "No se encontraron clientes con los filtros aplicados." }));

describe("EmptyState", () => {
  it("borde discontinuo de acero, radio de 14 px, relleno de 36 x 24 px y sin fondo", () => {
    const caja = classesOf(simple, "div");

    expect(caja).toEqual(expect.arrayContaining(["border-dashed", "border-control-border", "rounded-xl", "py-9", "px-6"]));
    expect(caja.filter((name) => name.startsWith("bg-"))).toEqual([]);
  });

  it("con icono: circulo de 44 px sobre el acento, titulo de 15 px y texto de 13 px", () => {
    expect(classesOf(completo, "span")).toEqual(expect.arrayContaining(["size-11", "bg-accent", "text-muted-foreground"]));
    expect(completo).toMatch(/<p class="[^"]*text-\[0\.9375rem\][^"]*font-semibold[^"]*text-foreground[^"]*">Todavia no hay materiales<\/p>/);
    expect(completo).toMatch(/<p class="[^"]*text-\[0\.8125rem\][^"]*text-muted-foreground[^"]*">Registra el primero\.<\/p>/);
  });

  it("solo con su texto: una linea de 13 px atenuada, sin titulo", () => {
    expect(simple).toMatch(
      /<p class="[^"]*text-\[0\.8125rem\][^"]*text-muted-foreground[^"]*">No se encontraron clientes con los filtros aplicados\.<\/p>/,
    );
    expect(simple).not.toContain("font-semibold");
  });
});
