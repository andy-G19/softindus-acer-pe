import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Diseno de listados y navegacion (propuesta del responsable, 2026-11-21; D163 y D164). La cabecera
// de la tabla es acero cepillado: --accent con la textura de metal, letra mono de 10,5 px en
// negrita con espaciado de 0,08em, una linea de acero de 2 px debajo y un filo de luz con sombra.
// Las reglas de tabla de patterns.css (D99) solo alcanzan a las tablas crudas, sin data-slot: antes
// ganaban a las clases del componente.

function withoutComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const html = renderToStaticMarkup(
  h(
    Table,
    null,
    h(TableHeader, null, h(TableRow, null, h(TableHead, null, "Código"))),
    h(TableBody, null, h(TableRow, null, h(TableCell, null, "CLI00000001"))),
  ),
);

function classesOf(slot: string) {
  return (html.match(new RegExp(`<[a-z]+ data-slot="${slot}" class="([^"]*)"`))?.[1] ?? "")
    .replaceAll("&amp;", "&")
    .split(" ");
}

describe("cabecera de la tabla", () => {
  // El fondo va en cada celda, como en la maqueta: en thead, el hover de TableRow lo taparia.
  it("acero cepillado: --accent con la textura de metal en cada celda", () => {
    expect(classesOf("table-head")).toEqual(expect.arrayContaining(["bg-accent", "bg-(image:--texture-metal)"]));
    expect(classesOf("table-header")).not.toContain("bg-secondary");
  });

  it("letra mono de 10,5 px en negrita, mayusculas y espaciado de 0,08em", () => {
    const head = classesOf("table-head");

    expect(head).toEqual(
      expect.arrayContaining(["font-mono", "text-[10.5px]", "font-bold", "uppercase", "tracking-[0.08em]", "px-4", "py-3"]),
    );
    expect(head).not.toContain("text-xs");
    expect(head).not.toContain("font-semibold");
  });

  it("linea de acero de 2 px debajo, con filo de luz y sombra", () => {
    const head = classesOf("table-head");

    expect(head).toEqual(expect.arrayContaining(["border-b-2", "border-control-border-hover", "shadow-table-head"]));
  });

  it("el filo y la sombra viven en tokens.css", () => {
    const tokens = withoutComments(readFileSync("src/styles/tokens.css", "utf8"));

    expect(tokens).toMatch(
      /^\s*--shadow-table-head:\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.06\),\s*0 2px 6px -2px rgba\(0, 0, 0, 0\.5\);/m,
    );
    expect(tokens).toMatch(/^\s*--shadow-table-head:\s*var\(--shadow-table-head\);/m);
  });
});

// D165: filas con las medidas de la maqueta, sin cebra. La primera columna (el codigo) en mono de
// 12,5 px y gris tenue; una celda que abarca columnas (el vacio, «Totales») no es un codigo, ni una
// con data-cell="text" (un nombre: el dato principal de su fila). Las paginas que la marcan lo
// muestran en sus instantaneas, que conservan los atributos data-* salvo data-slot.
describe("filas de la tabla", () => {
  it("texto de 13,5 px en la tabla", () => {
    const table = classesOf("table");

    expect(table).toContain("text-[13.5px]");
    expect(table).not.toContain("text-sm");
  });

  it("celda de 13 px por 16 px", () => {
    const cell = classesOf("table-cell");

    expect(cell).toEqual(expect.arrayContaining(["px-4", "py-[13px]"]));
    expect(cell).not.toContain("py-3");
  });

  it("la primera columna en mono de 12,5 px y gris tenue, salvo una celda que abarca columnas o un nombre", () => {
    const cell = classesOf("table-cell");

    expect(cell).toEqual(
      expect.arrayContaining([
        "[&:first-child:not([colspan]):not([data-cell=text])]:font-mono",
        "[&:first-child:not([colspan]):not([data-cell=text])]:text-[12.5px]",
        "[&:first-child:not([colspan]):not([data-cell=text])]:text-muted-foreground",
        "[&[colspan]]:text-muted-foreground",
      ]),
    );
    expect(cell).not.toContain("first:font-mono");
  });

  it("linea de --border, hover --muted y sin cebra", () => {
    const row = html.match(/<tr data-slot="table-row" class="([^"]*)"/g) ?? [];
    const bodyRow = (row[1]?.match(/class="([^"]*)"/)?.[1] ?? "").split(" ");

    expect(bodyRow).toEqual(
      expect.arrayContaining(["border-b", "border-border", "hover:bg-muted", "duration-(--motion-fast)", "ease-out"]),
    );
    expect(bodyRow).not.toContain("border-border/70");
    expect(bodyRow.some((name) => name.startsWith("even:") || name.startsWith("odd:"))).toBe(false);
  });
});

describe("reglas de tabla de patterns.css (D99)", () => {
  const patterns = withoutComments(readFileSync("src/styles/patterns.css", "utf8"));

  it("ninguna regla pinta la cabecera de una tabla del componente", () => {
    for (const part of ["table", "thead", "th", "tfoot", "caption"]) {
      expect(patterns).not.toMatch(new RegExp(`\\.industrial-dark\\s+${part}\\s*\\{`));
    }
  });

  it("ninguna regla pinta las filas ni las celdas de una tabla del componente", () => {
    expect(patterns).not.toMatch(/\.industrial-dark\s+td[\s[{]/);
    expect(patterns).not.toMatch(/\.industrial-dark\s+tbody/);
    expect(patterns).toMatch(/\.industrial-dark\s+table:not\(\[data-slot\]\)\s+td\s*\{/);
    expect(patterns).toMatch(/\.industrial-dark\s+table:not\(\[data-slot\]\)\s+tbody tr:hover\s*\{/);
    expect(patterns).toMatch(/\.industrial-dark\s+table:not\(\[data-slot\]\)\s+td\[colspan\]\s*\{/);
  });

  it("las de la cabecera solo alcanzan a las tablas crudas", () => {
    expect(patterns).toMatch(/\.industrial-dark\s+table:not\(\[data-slot\]\)\s+thead\s*\{/);
    expect(patterns).toMatch(/\.industrial-dark\s+table:not\(\[data-slot\]\)\s+th\s*\{/);
  });
});
