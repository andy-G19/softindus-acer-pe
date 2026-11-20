// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Field, type FieldControlProps } from "@/components/forms/field";
import { FileInput } from "@/components/ui/file-input";

// Campo de archivo (propuesta de los campos, 2026-11-19): el input real queda oculto a la vista
// pero no al teclado ni al lector, y la fila visible es su etiqueta: icono, nombre del archivo
// o «Ningun archivo seleccionado». La fila toma el aspecto de los demas campos y muestra el foco,
// el error y el deshabilitado del input que tiene al lado.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const html = renderToStaticMarkup(
  h(Field, {
    id: "adjunto",
    label: "Adjunto",
    description: "PDF o imagen, max. 10 MB.",
    children: (control: FieldControlProps) => h(FileInput, { ...control, name: "adjunto", accept: "application/pdf,image/*" }),
  }),
);

function classesOf(element: Element | null) {
  return (element?.getAttribute("class") ?? "").split(" ");
}

describe("FileInput en HTML", () => {
  it("el input real es de archivo, oculto a la vista y con las props de Field", () => {
    expect(html).toMatch(/<input[^>]*type="file"/);
    expect(html).toMatch(/<input[^>]*id="adjunto"/);
    expect(html).toMatch(/<input[^>]*aria-describedby="adjunto-ayuda"/);
    expect(html).toMatch(/<input[^>]*accept="application\/pdf,image\/\*"/);
    expect(html).toMatch(/<input[^>]*class="[^"]*sr-only[^"]*"/);
  });

  it("la fila visible es una etiqueta del input, con icono oculto al lector y el texto vacio", () => {
    expect(html).toMatch(/<label[^>]*data-slot="file-input-row"[^>]*for="adjunto"|<label[^>]*for="adjunto"[^>]*data-slot="file-input-row"/);
    expect(html).toMatch(/<svg[^>]*class="[^"]*lucide-paperclip[^"]*"[^>]*aria-hidden="true"/);
    expect(html).toContain("Ningún archivo seleccionado");
  });
});

describe("FileInput en el navegador", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("la fila muestra el foco, el error y el deshabilitado del input (peer)", () => {
    act(() => root.render(h(FileInput, { id: "adjunto" })));
    const fila = classesOf(host.querySelector('[data-slot="file-input-row"]'));

    expect(fila).toEqual(
      expect.arrayContaining([
        "border-control-border",
        "bg-card",
        "peer-focus-visible:border-primary",
        "peer-focus-visible:ring-2",
        "peer-focus-visible:ring-offset-2",
        "peer-aria-invalid:border-destructive-outline",
        "peer-disabled:opacity-65",
        "motion-reduce:transition-none",
      ]),
    );
    expect(classesOf(host.querySelector('input[type="file"]'))).toContain("peer");
  });

  it("al elegir un archivo muestra su nombre", () => {
    act(() => root.render(h(FileInput, { id: "adjunto" })));
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    const archivo = new File(["contenido"], "orden-OTR00000010.pdf", { type: "application/pdf" });

    Object.defineProperty(input, "files", { value: [archivo], configurable: true });
    act(() => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(host.querySelector('[data-slot="file-input-row"]')?.textContent).toContain("orden-OTR00000010.pdf");
    expect(host.textContent).not.toContain("Ningún archivo seleccionado");
  });
});
