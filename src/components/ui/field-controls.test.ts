import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

// Diseno de los campos, paso 1 (D99): las reglas de patterns.css que pintaban fondo, borde,
// foco, deshabilitado, texto de ejemplo y opciones de todos los campos ganaban a las clases
// de los componentes, asi que lo que se veia no era lo que decian sus clases. Pasaron a cada
// componente con los valores que se median en staging. Esta prueba impide que vuelvan a
// patterns.css y que un componente pierda lo que hoy declara por su cuenta.

function classesOf(html: string, tag: string) {
  // El HTML escribe & como &amp; dentro del atributo.
  return (new RegExp(`<${tag} [^>]*class="([^"]*)"`).exec(html)?.[1] ?? "").replaceAll("&amp;", "&").split(" ");
}

const controles = {
  Input: classesOf(renderToStaticMarkup(h(Input)), "input"),
  NativeSelect: classesOf(renderToStaticMarkup(h(NativeSelect)), "select"),
  Textarea: classesOf(renderToStaticMarkup(h(Textarea)), "textarea"),
  SearchableSelect: classesOf(
    renderToStaticMarkup(h(SearchableSelect, { name: "cliente", label: "Cliente", items: [] })),
    "input",
  ),
};

describe("campos sin reglas globales", () => {
  it("patterns.css solo estiliza las casillas sueltas, no los campos en general", () => {
    const patterns = readFileSync("src/styles/patterns.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectores = [...patterns.matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim());
    const deCampos = selectores.filter((selector) => /\b(input|select|textarea)\b/.test(selector));

    expect(deCampos.filter((selector) => !selector.includes('input[type="checkbox"]'))).toEqual([]);
  });

  for (const [nombre, clases] of Object.entries(controles)) {
    it(`${nombre} declara su borde, su texto, su transicion y su foco`, () => {
      const esperadas = [
        "border-border",
        "text-foreground",
        "transition-[color,background-color,border-color,box-shadow]",
        "duration-(--motion-fast)",
        "input-forge-focus",
        "disabled:text-muted-foreground",
      ];

      expect(esperadas.filter((clase) => !clases.includes(clase))).toEqual([]);
      expect(clases).not.toContain("transition-colors");
    });
  }

  it("los campos con texto de ejemplo usan el token del placeholder", () => {
    for (const nombre of ["Input", "Textarea", "SearchableSelect"] as const) {
      expect(controles[nombre]).toContain("placeholder:text-placeholder");
    }
  });

  it("NativeSelect pinta sus opciones y su fondo deshabilitado", () => {
    expect(controles.NativeSelect).toContain("[&_option]:bg-popover");
    expect(controles.NativeSelect).toContain("[&_option]:text-popover-foreground");
    expect(controles.NativeSelect).toContain("dark:disabled:bg-muted");
  });
});
