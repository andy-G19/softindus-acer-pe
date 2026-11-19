import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SearchableSelect } from "@/components/forms/searchable-select";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

// Diseno de los campos.
// Paso 1 (D99): las reglas de patterns.css que pintaban fondo, borde, foco, deshabilitado,
// texto de ejemplo y opciones de todos los campos ganaban a las clases de los componentes.
// Pasaron a cada componente y no deben volver.
// Paso 2 (propuesta del responsable, 2026-11-19): fondo de tarjeta con textura de metal
// cepillado, borde de acero que se ve (3:1), foco con el anillo y el hueco de los botones,
// error en rojo, solo lectura en acero y deshabilitado atenuado, con la altura de siempre.

function classesOf(html: string, tag: string) {
  // El HTML escribe & como &amp; dentro del atributo.
  return (new RegExp(`<${tag} [^>]*class="([^"]*)"`).exec(html)?.[1] ?? "").replaceAll("&amp;", "&").split(" ");
}

const selectHtml = renderToStaticMarkup(h(NativeSelect));

const controles = {
  Input: classesOf(renderToStaticMarkup(h(Input)), "input"),
  NativeSelect: classesOf(selectHtml, "select"),
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
});

describe("diseno de los campos", () => {
  const comunes = [
    // Reposo: tarjeta con textura y borde de acero.
    "bg-card",
    "bg-(image:--texture-metal)",
    "border-control-border",
    "text-foreground",
    "hover:border-control-border-hover",
    // Foco: el anillo con hueco de los botones, sobre el borde naranja.
    "focus-visible:border-primary",
    "focus-visible:ring-2",
    "focus-visible:ring-ring",
    "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-background",
    // Error: borde y anillo rojos, sin halo en reposo.
    "aria-invalid:border-destructive-outline",
    "aria-invalid:focus-visible:border-destructive-outline",
    "aria-invalid:focus-visible:ring-destructive-outline",
    // Deshabilitado: sin textura, apagado y atenuado.
    "disabled:bg-muted",
    "disabled:bg-none",
    "disabled:border-border",
    "disabled:text-muted-foreground",
    "disabled:opacity-65",
    "disabled:cursor-not-allowed",
    // Movimiento: 200 ms, nada con reducir movimiento.
    "transition-[color,background-color,border-color,box-shadow]",
    "duration-(--motion-base)",
    "ease-out",
    "motion-reduce:transition-none",
  ];

  for (const [nombre, clases] of Object.entries(controles)) {
    it(`${nombre} usa el diseno de la propuesta`, () => {
      expect(comunes.filter((clase) => !clases.includes(clase))).toEqual([]);
    });

    it(`${nombre} ya no usa el foco ni el error anteriores, ni variantes dark:`, () => {
      expect(clases).not.toContain("input-forge-focus");
      expect(clases).not.toContain("aria-invalid:ring-3");
      expect(clases.filter((clase) => clase.startsWith("dark:"))).toEqual([]);
    });
  }

  it("los campos con texto de ejemplo usan el token del placeholder", () => {
    for (const nombre of ["Input", "Textarea", "SearchableSelect"] as const) {
      expect(controles[nombre]).toContain("placeholder:text-placeholder");
    }
  });

  it("solo lectura: borde y anillo de acero, en los campos que lo admiten", () => {
    for (const nombre of ["Input", "Textarea"] as const) {
      expect(controles[nombre]).toContain("[&[readonly]]:border-readonly-border");
      expect(controles[nombre]).toContain("[&[readonly]]:focus-visible:border-accent-steel");
      expect(controles[nombre]).toContain("[&[readonly]]:focus-visible:ring-accent-steel");
    }
  });

  it("los numeros se alinean con cifras tabulares", () => {
    expect(controles.Input).toContain("[&[type=number]]:tabular-nums");
  });

  it("NativeSelect usa su propia flecha, sus opciones y su fondo deshabilitado", () => {
    expect(controles.NativeSelect).toContain("appearance-none");
    expect(controles.NativeSelect).toContain("[&_option]:bg-popover");
    expect(controles.NativeSelect).toContain("[&_option]:text-popover-foreground");
    expect(selectHtml).toMatch(/<svg[^>]*class="[^"]*lucide-chevron-down[^"]*"[^>]*aria-hidden="true"/);
  });
});
