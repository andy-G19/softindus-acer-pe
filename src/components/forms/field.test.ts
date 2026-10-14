import { createElement as h, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Field, FieldError, type FieldControlProps } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

// Contrato del campo compartido (entrega 8). El HTML completo, con clases, esta
// en primitives.test.ts; aqui se exige cada regla de accesibilidad por separado.

function render(node: ReactNode) {
  return renderToStaticMarkup(node);
}

function attr(html: string, tag: string, name: string) {
  const element = html.match(new RegExp(`<${tag}\\b[^>]*>`))?.[0] ?? "";
  return element.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
}

const input = (control: FieldControlProps) => h(Input, { ...control, name: "correo" });

describe("FieldError", () => {
  it("tiene el mismo HTML que las 14 copias locales", () => {
    expect(render(h(FieldError, { messages: ["Ingrese un correo valido.", "Otro"] }))).toBe(
      '<p class="text-sm text-destructive">Ingrese un correo valido.</p>',
    );
  });

  it("en tamano sm tiene el mismo HTML que las 2 copias de los catalogos", () => {
    expect(render(h(FieldError, { messages: ["Requerido"], size: "sm" }))).toBe(
      '<p class="text-xs text-destructive">Requerido</p>',
    );
  });

  it("con id lo asocia y sin mensajes no muestra nada", () => {
    expect(render(h(FieldError, { id: "correo-error", messages: ["x"] }))).toBe(
      '<p id="correo-error" class="text-sm text-destructive">x</p>',
    );
    expect(render(h(FieldError, { messages: [] }))).toBe("");
    expect(render(h(FieldError, {}))).toBe("");
  });
});

describe("Field", () => {
  it("la etiqueta apunta al control", () => {
    const html = render(h(Field, { id: "correo", label: "Correo", children: input }));

    expect(attr(html, "label", "for")).toBe("correo");
    expect(attr(html, "input", "id")).toBe("correo");
  });

  it("sin id genera uno y la etiqueta lo usa", () => {
    const html = render(h(Field, { label: "Correo", children: input }));
    const id = attr(html, "input", "id");

    expect(id).toBeTruthy();
    expect(attr(html, "label", "for")).toBe(id);
  });

  it("asocia el error: aria-invalid y aria-describedby con el id del mensaje", () => {
    const html = render(h(Field, { id: "correo", label: "Correo", errors: ["Ingrese un correo valido."], children: input }));

    expect(attr(html, "input", "aria-invalid")).toBe("true");
    expect(attr(html, "input", "aria-describedby")).toBe("correo-error");
    expect(html).toContain('<p id="correo-error" class="text-sm text-destructive">Ingrese un correo valido.</p>');
  });

  it("describe con la ayuda y el error, en ese orden", () => {
    const html = render(
      h(Field, { id: "correo", label: "Correo", description: "Para la proforma.", errors: ["Invalido"], children: input }),
    );

    expect(attr(html, "input", "aria-describedby")).toBe("correo-ayuda correo-error");
    expect(html).toContain('<p id="correo-ayuda" class="text-xs text-muted-foreground">Para la proforma.</p>');
    expect(html.indexOf('id="correo-ayuda"')).toBeLessThan(html.indexOf('id="correo-error"'));
  });

  it("sin error no marca invalido ni nombra un id que no existe", () => {
    const html = render(h(Field, { id: "correo", label: "Correo", description: "Ayuda", errors: [], children: input }));

    expect(attr(html, "input", "aria-invalid")).toBeUndefined();
    expect(attr(html, "input", "aria-describedby")).toBe("correo-ayuda");
    expect(html).not.toContain("correo-error");
    expect(attr(render(h(Field, { id: "correo", label: "Correo", children: input })), "input", "aria-describedby")).toBeUndefined();
  });

  it("obligatorio: required en el control y asterisco visible oculto al lector", () => {
    const html = render(h(Field, { id: "correo", label: "Correo", required: true, children: input }));

    expect(html).toMatch(/<input\b[^>]*\srequired=""/);
    expect(html).toContain('<span aria-hidden="true" class="text-destructive">*</span>');
    expect(render(h(Field, { id: "correo", label: "Correo", children: input }))).not.toContain("*");
  });

  it("deshabilitado: llega al control y atenua la etiqueta", () => {
    const html = render(h(Field, { id: "correo", label: "Correo", disabled: true, children: input }));

    expect(html).toMatch(/<input\b[^>]*\sdisabled=""/);
    expect(html).toMatch(/^<div data-slot="field" data-disabled="true" class="group /);
  });

  it("solo lectura: llega al control", () => {
    const html = render(h(Field, { id: "codigo", label: "Codigo", readOnly: true, children: input }));

    // React escribe readOnly=""; el parser HTML pasa el nombre a minusculas y
    // el selector [readonly] de los estilos lo encuentra.
    expect(html).toMatch(/<input\b[^>]*\sreadonly=""/i);
  });

  it("funciona igual con lista y area de texto", () => {
    const select = render(
      h(Field, {
        id: "tipo",
        label: "Tipo",
        errors: ["Elija uno"],
        children: (control) => h(NativeSelect, control, h("option", { value: "" }, "Todos")),
      }),
    );
    const textarea = render(h(Field, { id: "motivo", label: "Motivo", errors: ["Requerido"], children: (control) => h(Textarea, control) }));

    expect(attr(select, "select", "aria-describedby")).toBe("tipo-error");
    expect(attr(select, "select", "aria-invalid")).toBe("true");
    expect(attr(textarea, "textarea", "aria-describedby")).toBe("motivo-error");
  });
});

describe("estilos de solo lectura y error de las primitivas", () => {
  const classOf = (node: ReactNode, tag: string) => attr(render(node), tag, "class") ?? "";

  it("usan el atributo [readonly], nunca la variante read-only:", () => {
    // :read-only coincide con todo select y con los input deshabilitados, de
    // archivo o casillas: cambiaria campos que no son de solo lectura.
    for (const [node, tag] of [
      [h(Input), "input"],
      [h(Textarea), "textarea"],
      [h(NativeSelect), "select"],
    ] as const) {
      expect(classOf(node, tag)).not.toMatch(/(^|[\s:])read-only:/);
    }
    expect(classOf(h(Input), "input")).toContain("dark:[&amp;[readonly]]:bg-muted");
    expect(classOf(h(Textarea), "textarea")).toContain("dark:[&amp;[readonly]]:bg-muted");
  });

  it("la lista muestra el error como el campo de texto", () => {
    expect(classOf(h(NativeSelect), "select")).toContain("aria-invalid:border-destructive aria-invalid:ring-3");
  });
});
