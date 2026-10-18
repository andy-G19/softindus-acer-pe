import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DateRangeFields } from "@/components/forms/date-range-fields";
import { FilterBar } from "@/components/forms/filter-bar";
import { TableLoadingRows } from "@/components/table/table-loading-rows";
import { Input } from "@/components/ui/input";
import { Table, TableBody } from "@/components/ui/table";
import { DATE_RANGE_INVERTED_MESSAGE } from "@/lib/date-range";

// Listados compartidos (entrega 8). El HTML completo, con clases, esta en
// primitives.test.ts; aqui se exige cada regla por separado. La validacion al
// escribir (setCustomValidity en un efecto) necesita un navegador: se prueba a
// mano en la galeria; el estado que llega en la URL si se prueba aqui.

function render(node: ReactNode) {
  return renderToStaticMarkup(node);
}

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? "";
}

function input(html: string, name: string) {
  return tag(html, new RegExp(`<input [^>]*name="${name}"[^>]*>`));
}

const CLIENTS = "/dashboard/commercial/clients";

describe("FilterBar", () => {
  const html = render(
    h(FilterBar, { action: CLIENTS, label: "Filtros de clientes", clearHref: CLIENTS, children: h(Input, { name: "q" }) }),
  );

  it("es un formulario GET de busqueda con nombre", () => {
    const form = tag(html, /^<form [^>]*>/);

    expect(form).toContain('method="GET"');
    expect(form).toContain(`action="${CLIENTS}"`);
    expect(form).toContain('role="search"');
    expect(form).toContain('aria-label="Filtros de clientes"');
  });

  it("es un contenedor con una sola rejilla adaptable", () => {
    expect(tag(html, /^<form [^>]*>/)).toMatch(/class="@container grid grid-cols-\[repeat\(auto-fit,minmax\(12rem,1fr\)\)\]/);
  });

  it("incluye los campos, el envio y el enlace para limpiar", () => {
    expect(html).toContain('name="q"');
    expect(tag(html, /<button [^>]*type="submit"[^>]*>[^<]*/)).toContain(">Filtrar");
    expect(tag(html, /<a [^>]*>[^<]*/)).toMatch(new RegExp(`data-variant="clear".*href="${CLIENTS}".*>Limpiar filtros`));
  });
});

describe("DateRangeFields", () => {
  it("agrupa Desde y Hasta con una leyenda y usa from/to por defecto", () => {
    const html = render(h(DateRangeFields, { id: "rango" }));

    expect(html).toMatch(/^<fieldset [^>]*class="[^"]*@md:col-span-2/);
    expect(html).toContain('<legend class="sr-only">Rango de fechas</legend>');
    expect(input(html, "from")).toContain('id="rango-desde"');
    expect(input(html, "to")).toContain('id="rango-hasta"');
    expect(html).toMatch(/<label [^>]*for="rango-desde"[^>]*>Desde<\/label>/);
    expect(html).toMatch(/<label [^>]*for="rango-hasta"[^>]*>Hasta<\/label>/);
  });

  it("conserva los nombres de la URL de cada pantalla", () => {
    const html = render(
      h(DateRangeFields, { id: "rango", fromName: "dateFrom", toName: "dateTo", defaultFrom: "2026-10-01", defaultTo: "2026-10-13" }),
    );

    expect(input(html, "dateFrom")).toContain('value="2026-10-01"');
    expect(input(html, "dateTo")).toContain('value="2026-10-13"');
  });

  it("Hasta no ofrece fechas anteriores a Desde; Desde no lleva max", () => {
    const html = render(h(DateRangeFields, { id: "rango", defaultFrom: "2026-10-01" }));

    expect(input(html, "to")).toContain('min="2026-10-01"');
    expect(input(html, "from")).not.toContain("max=");
    expect(input(render(h(DateRangeFields, { id: "rango" })), "to")).not.toContain("min=");
  });

  it("si la URL llega invertida, marca Hasta y muestra el mensaje asociado", () => {
    const html = render(h(DateRangeFields, { id: "rango", defaultFrom: "2026-10-13", defaultTo: "2026-10-01" }));
    const to = input(html, "to");

    expect(to).toContain('aria-invalid="true"');
    expect(to).toContain('aria-describedby="rango-hasta-error"');
    expect(html).toContain(`<p id="rango-hasta-error" class="text-sm text-destructive">${DATE_RANGE_INVERTED_MESSAGE}</p>`);
    expect(input(html, "from")).not.toContain('aria-invalid="');
  });

  it("en orden no muestra error", () => {
    const html = render(h(DateRangeFields, { id: "rango", defaultFrom: "2026-10-01", defaultTo: "2026-10-01" }));

    expect(html).not.toContain('aria-invalid="');
    expect(html).not.toContain(DATE_RANGE_INVERTED_MESSAGE);
  });

  // Entrega 10.2: el navegador deja vacio un campo de fecha cuyo valor no es
  // "aaaa-mm-dd" con una fecha que existe; el rango no se valida con ese
  // valor, que el campo no muestra.
  it.each([
    ["una fecha sin ceros en Desde", "2026-7-5", "2026-07-01", "", "2026-07-01"],
    ["un dia que no existe en Desde", "2026-02-30", "2026-02-01", "", "2026-02-01"],
    ["una fecha sin ceros en Hasta", "2026-10-13", "2026-1-05", "2026-10-13", ""],
  ])("con %s no marca el rango", (_case, defaultFrom, defaultTo, shownFrom, shownTo) => {
    const html = render(h(DateRangeFields, { id: "rango", defaultFrom, defaultTo }));

    expect(html).not.toContain('aria-invalid="');
    expect(html).not.toContain(DATE_RANGE_INVERTED_MESSAGE);
    expect(input(html, "from")).toContain(`value="${shownFrom}"`);
    expect(input(html, "to")).toContain(`value="${shownTo}"`);
    expect(input(html, "to")).toContain(shownFrom ? `min="${shownFrom}"` : 'name="to"');
    expect(input(html, "to").includes("min=")).toBe(Boolean(shownFrom));
  });
});

describe("TableLoadingRows", () => {
  const html = render(h(Table, null, h(TableBody, null, h(TableLoadingRows, { columns: 4, rows: 3, label: "Cargando clientes..." }))));

  it("pinta filas por columnas", () => {
    const rows = html.match(/<tr [^>]*data-slot="table-loading-row"/g) ?? [];
    const cells = html.match(/<td /g) ?? [];

    expect(rows).toHaveLength(3);
    expect(cells).toHaveLength(12);
  });

  it("anuncia la carga una sola vez, dentro de una celda y oculta a la vista", () => {
    const statuses = html.match(/<div role="status"[^>]*>/g) ?? [];

    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toMatch(/class="[^"]*\bsr-only\b/);
    expect(html).toContain("<span>Cargando clientes...</span>");
    expect(html).not.toMatch(/<tr [^>]*role=/);
  });

  it("los bloques son decorativos", () => {
    const skeletons = html.match(/<div [^>]*data-slot="skeleton"[^>]*>/g) ?? [];

    expect(skeletons).toHaveLength(12);
    for (const skeleton of skeletons) {
      expect(skeleton).toContain('aria-hidden="true"');
    }
  });
});
