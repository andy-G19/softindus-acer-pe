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

// Diseno de los campos (propuesta del responsable, 2026-11-19): el error es un texto de 12 px
// en el rojo de los bordes de error (6,2:1 sobre la tarjeta), en medio peso y con un icono de
// alerta que el lector no anuncia. Un solo tamano: el sm de los catalogos ya no tenia uso.
describe("FieldError", () => {
  it("muestra el primer mensaje con su icono de alerta, oculto al lector", () => {
    const html = render(h(FieldError, { messages: ["Ingrese un correo valido.", "Otro"] }));

    expect(html).toContain("Ingrese un correo valido.");
    expect(html).not.toContain("Otro");
    expect(html).toMatch(/<svg[^>]*class="[^"]*lucide-circle-alert[^"]*"[^>]*aria-hidden="true"/);
  });

  it("usa el rojo de los bordes de error, a 12 px y en medio peso", () => {
    const classes = attr(render(h(FieldError, { messages: ["x"] })), "p", "class")?.split(" ") ?? [];

    expect(classes).toEqual(expect.arrayContaining(["text-xs", "font-medium", "text-destructive-outline"]));
  });

  it("con id lo asocia y sin mensajes no muestra nada", () => {
    expect(attr(render(h(FieldError, { id: "correo-error", messages: ["x"] })), "p", "id")).toBe("correo-error");
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
    expect(html).toMatch(/<p id="correo-error"[^>]*>[\s\S]*Ingrese un correo valido\.<\/p>/);
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
    // Diseno de los campos: el asterisco es cobre, no rojo, para no parecer un error.
    expect(html).toContain('<span aria-hidden="true" class="font-semibold text-accent-copper">*</span>');
    expect(render(h(Field, { id: "correo", label: "Correo", children: input }))).not.toContain("*");
  });

  it("etiqueta de 13 px y separacion de 6 px entre etiqueta, control y ayuda", () => {
    const html = render(h(Field, { id: "correo", label: "Correo", children: input }));

    expect(attr(html, "label", "class")?.split(" ")).toContain("text-[0.8125rem]");
    expect(attr(html, "div", "class")?.split(" ")).toContain("space-y-1.5");
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

  // Diseno de los campos: un chip «Solo lectura» en acero claro (6,9:1) antes de la ayuda. Es
  // visual: el lector ya anuncia el readonly del control, asi que el chip va oculto para el.
  it("solo lectura: muestra el chip antes de la ayuda, oculto al lector", () => {
    const html = render(
      h(Field, { id: "codigo", label: "Codigo", readOnly: true, description: "Lo asigna el sistema.", children: input }),
    );
    const ayuda = /<p id="codigo-ayuda"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";

    expect(ayuda).toMatch(/<span aria-hidden="true" class="[^"]*text-readonly-foreground[^"]*">/);
    expect(ayuda).toContain("Solo lectura");
    expect(ayuda).toMatch(/lucide-lock/);
    expect(ayuda).toContain("Lo asigna el sistema.");
  });

  // Diseno de los campos: «Validado» es una confirmacion real (por ejemplo, el RUC en SUNAT),
  // no el reposo de ningun campo. Marca el control con data-valid, que sus clases pintan en
  // verde forja, y muestra el mensaje con un icono de check, asociado como la ayuda.
  it("validado: marca el control y anuncia el mensaje asociado", () => {
    const html = render(
      h(Field, { id: "ruc", label: "RUC", success: "Validado en SUNAT.", children: input }),
    );

    expect(attr(html, "input", "data-valid")).toBe("true");
    expect(attr(html, "input", "aria-describedby")).toBe("ruc-validado");
    expect(html).toMatch(/<p id="ruc-validado" class="[^"]*text-success[^"]*">[\s\S]*Validado en SUNAT\.<\/p>/);
    expect(html).toMatch(/<svg[^>]*class="[^"]*lucide-circle-check[^"]*"[^>]*aria-hidden="true"/);
  });

  it("con error no se muestra como validado", () => {
    const html = render(
      h(Field, { id: "ruc", label: "RUC", success: "Validado en SUNAT.", errors: ["El RUC no existe."], children: input }),
    );

    expect(attr(html, "input", "data-valid")).toBeUndefined();
    expect(html).not.toContain("Validado en SUNAT.");
    expect(attr(html, "input", "aria-describedby")).toBe("ruc-error");
  });

  it("solo lectura sin ayuda: el chip igual aparece; sin readOnly no hay chip", () => {
    expect(render(h(Field, { id: "codigo", label: "Codigo", readOnly: true, children: input }))).toContain(
      "Solo lectura",
    );
    expect(
      render(h(Field, { id: "codigo", label: "Codigo", description: "Ayuda.", children: input })),
    ).not.toContain("Solo lectura");
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
    // Diseno de los campos: solo lectura es borde de acero, no un fondo apagado.
    expect(classOf(h(Input), "input")).toContain("[&amp;[readonly]]:border-readonly-border");
    expect(classOf(h(Textarea), "textarea")).toContain("[&amp;[readonly]]:border-readonly-border");
  });

  it("la lista muestra el error como el campo de texto", () => {
    const errorClasses = (classes: string) => classes.split(" ").filter((name) => name.startsWith("aria-invalid:"));

    expect(errorClasses(classOf(h(NativeSelect), "select"))).toEqual(errorClasses(classOf(h(Input), "input")));
    expect(errorClasses(classOf(h(Input), "input"))).toContain("aria-invalid:border-destructive-outline");
  });
});
