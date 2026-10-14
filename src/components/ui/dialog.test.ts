import { createElement as h, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

// Ventana y panel lateral (entrega 8). Como en confirm-dialog.test.ts, el doble
// de Radix vuelve el Portal un paso directo y abre la ventana para fijar en
// Node lo que recibe el lector de pantalla y la estructura que mantiene el pie
// fijo. La trampa de foco, Esc, la devolucion del foco y el desplazamiento con
// teclado se prueban a mano en la galeria.

vi.mock("radix-ui", async (importOriginal) => {
  const radix = await importOriginal<typeof import("radix-ui")>();
  const { createElement, Fragment } = await import("react");

  return {
    ...radix,
    Dialog: {
      ...radix.Dialog,
      Root: (props: ComponentProps<typeof radix.Dialog.Root>) =>
        createElement(radix.Dialog.Root, { ...props, open: true }),
      Portal: ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children),
    },
  };
});

function render(node: ReactNode) {
  return renderToStaticMarkup(node);
}

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? "";
}

function classOf(html: string, slot: string) {
  return tag(html, new RegExp(`<[a-z0-9]+ [^>]*data-slot="${slot}"[^>]*>`)).match(/class="([^"]*)"/)?.[1] ?? "";
}

const trigger = h(Button, { type: "button" }, "Registrar pago");

function dialog(contentProps: Partial<ComponentProps<typeof DialogContent>> = {}) {
  return h(
    Dialog,
    null,
    h(DialogTrigger, { asChild: true }, trigger),
    h(
      DialogContent,
      contentProps,
      h(DialogHeader, null, h(DialogTitle, null, "Registrar pago"), h(DialogDescription, null, "Pedido PED00000099")),
      h(DialogBody, null, "Campos del pago"),
      h(DialogFooter, null, h(Button, { type: "button", variant: "outline" }, "Cancelar"), h(Button, { type: "button" }, "Registrar pago")),
    ),
  );
}

function sheet(side?: "right" | "left") {
  return h(
    Sheet,
    null,
    h(SheetTrigger, { asChild: true }, h(Button, { type: "button" }, "Filtros")),
    h(
      SheetContent,
      { side, "aria-describedby": undefined },
      h(SheetHeader, null, h(SheetTitle, null, "Filtros")),
      h(SheetBody, null, "Campos de filtro"),
      h(SheetFooter, null, h(Button, { type: "button" }, "Aplicar")),
    ),
  );
}

// Una etiqueta por linea, como en primitives.test.ts.
const markup = (node: ReactNode) => render(node).replace(/></g, ">\n<");

describe("Dialog", () => {
  it("es un dialog con el titulo y la descripcion asociados", () => {
    const html = render(dialog());
    const content = tag(html, /<div role="dialog"[^>]*>/);
    const labelledBy = content.match(/aria-labelledby="([^"]+)"/)?.[1];
    const describedBy = content.match(/aria-describedby="([^"]+)"/)?.[1];

    expect(tag(html, new RegExp(`<h2 id="${labelledBy}"[^>]*>[^<]*`))).toContain("Registrar pago");
    expect(tag(html, new RegExp(`<p id="${describedBy}"[^>]*>[^<]*`))).toContain("PED00000099");
  });

  it("encabezado, cuerpo y pie en orden; solo el cuerpo se desplaza", () => {
    const html = render(dialog());
    const order = ["dialog-header", "dialog-body", "dialog-footer"].map((slot) => html.indexOf(`data-slot="${slot}"`));

    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(classOf(html, "dialog-body")).toMatch(/\bmin-h-0\b.*\bflex-1\b.*\boverflow-y-auto\b/);
    expect(classOf(html, "dialog-header")).toContain("shrink-0");
    expect(classOf(html, "dialog-footer")).toContain("shrink-0");
    expect(classOf(html, "dialog-content")).toMatch(/\bflex\b.*\bflex-col\b/);
  });

  it("la X de cerrar tiene nombre y va al final, despues del pie", () => {
    const html = render(dialog());
    const close = tag(html, /<button [^>]*aria-label="Cerrar"[^>]*>/);

    expect(close).toContain('data-size="icon-sm"');
    expect(html.indexOf('aria-label="Cerrar"')).toBeGreaterThan(html.indexOf('data-slot="dialog-footer"'));
    expect(render(dialog({ showCloseButton: false }))).not.toContain('aria-label="Cerrar"');
  });

  it("en movil ocupa la pantalla y desde sm es una ventana centrada", () => {
    const content = classOf(render(dialog()), "dialog-content");

    expect(content).toMatch(/(^|\s)inset-0(\s|$)/);
    expect(content).toMatch(/(^|\s)h-dvh(\s|$)/);
    expect(content).toContain("sm:inset-auto");
    expect(content).toContain("sm:max-w-lg");
    expect(content).toContain("sm:max-h-[calc(100dvh-4rem)]");
  });

  it("el velo usa su token y las animaciones se detienen con reduced motion", () => {
    const html = render(dialog());

    expect(classOf(html, "dialog-overlay")).toContain("bg-overlay");
    for (const slot of ["dialog-overlay", "dialog-content"]) {
      expect(classOf(html, slot)).toContain("motion-reduce:animate-none!");
    }
  });

  it("HTML de la ventana abierta", () => {
    expect(markup(dialog())).toMatchSnapshot();
  });
});

describe("Sheet", () => {
  it.each([
    ["right", "right-0", "slide-in-from-right", "sm:border-l"],
    ["left", "left-0", "slide-in-from-left", "sm:border-r"],
  ] as const)("del lado %s se ancla a su borde y entra desde el", (side, anchor, slide, border) => {
    const content = classOf(render(sheet(side)), "sheet-content");

    expect(content).toMatch(new RegExp(`(^|\\s)${anchor}(\\s|$)`));
    expect(content).toContain(`data-open:${slide}`);
    expect(content).toContain(border);
  });

  it("sin lado va a la derecha", () => {
    expect(render(sheet())).toContain('data-side="right"');
  });

  it("reutiliza las piezas de Dialog y ocupa la pantalla en movil", () => {
    const html = render(sheet());

    expect(tag(html, /<div role="dialog"[^>]*>/)).not.toContain("aria-describedby");
    for (const slot of ["dialog-header", "dialog-body", "dialog-footer"]) {
      expect(html).toContain(`data-slot="${slot}"`);
    }
    expect(classOf(html, "sheet-content")).toMatch(/\bw-full\b.*\bsm:max-w-md\b/);
    expect(classOf(html, "sheet-content")).toContain("motion-reduce:animate-none!");
  });

  it.each(["right", "left"] as const)("HTML del panel abierto: %s", (side) => {
    expect(markup(sheet(side))).toMatchSnapshot();
  });
});
