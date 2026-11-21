import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ListingSection } from "@/modules/gallery/sections/listing-section";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back() {}, forward() {}, push() {}, replace() {}, refresh() {}, prefetch() {} }),
  usePathname: () => "/dashboard/gallery",
  useSearchParams: () => new URLSearchParams(),
}));

// Listados con el diseno de la propuesta (2026-11-21; D163 a D171). La galeria muestra la tabla
// con las acciones de fila como en las listas reales (Editar y Activar como enlaces, Inactivar en
// xs, alineadas a la derecha), y sus notas describen la cabecera, las filas, la etiqueta simple,
// las flechas de la paginacion y el separador de las migas.

const html = renderToStaticMarkup(h(ListingSection)).replaceAll("&quot;", '"');

function figure(caption: string) {
  const start = html.indexOf(`>${caption}<`);
  const end = html.indexOf("</figure>", start);
  return start === -1 ? "" : html.slice(start, end);
}

function notes() {
  // GalleryNote es un <p> con la letra de las notas; las figuras usan otros elementos.
  return [...html.matchAll(/<p class="text-xs leading-relaxed text-muted-foreground">([\s\S]*?)<\/p>/g)].map((match) =>
    match[1].replace(/\s+/g, " "),
  );
}

describe("galeria de listados", () => {
  const table = figure("Tabla con acciones por fila");

  it("las acciones de la fila: Editar y Activar como enlaces, Inactivar destructivo xs", () => {
    expect(table).toMatch(/<a [^>]*data-variant="row-link"[^>]*>Editar<\/a>/);
    expect(table).toMatch(/<button [^>]*data-variant="row-link"[^>]*>Activar<\/button>/);
    expect(table).toMatch(/<button [^>]*data-variant="destructive" data-size="xs"[^>]*>Inactivar<\/button>/);
  });

  it("la cabecera «Acciones» va a la derecha, como la columna", () => {
    expect(table).toMatch(/<th [^>]*class="[^"]*\btext-right\b[^"]*">Acciones<\/th>/);
  });

  it("la columna de estados no repite el estilo de la primera columna a mano", () => {
    const states = figure("Etiquetas de estado (StateBadge)");

    expect(states).toMatch(/<td data-slot="table-cell" class="[^"]*">pagada<\/td>/);
    expect(states).not.toMatch(/class="[^"]*\btext-xs\b[^"]*">pagada</);
  });

  it("las notas describen el diseno de la propuesta", () => {
    const text = notes().join(" ");

    for (const phrase of [
      "acero cepillado",
      "sin cebra",
      "data-cell",
      "enlaces de texto",
      "La confirmación sigue siendo la ventana",
      "sin gestos",
      "flecha",
      "«›»",
    ]) {
      expect(text).toContain(phrase);
    }
  });
});
