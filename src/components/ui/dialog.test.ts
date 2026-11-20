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
// fijo. El foco inicial se prueba con el Radix real en dialog-focus.test.ts;
// Esc, la devolucion del foco y el teclado real, a mano en la galeria.

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

  it("el cuerpo, cuando entra en el orden de Tab, muestra un anillo de foco hacia dentro", () => {
    const body = classOf(render(dialog()), "dialog-body");

    for (const token of ["outline-none", "focus-visible:ring-3", "focus-visible:ring-inset", "focus-visible:ring-ring/50"]) {
      expect(body.split(" ")).toContain(token);
    }
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
    // Diseno de ventanas (2026-11-20): 480 px desde sm (antes max-w-lg).
    expect(content).toContain("sm:max-w-[480px]");
    expect(content).toContain("sm:max-h-[min(640px,86vh)]");
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
    // Diseno de ventanas (2026-11-20): 380 px desde sm (antes max-w-md).
    expect(classOf(html, "sheet-content")).toMatch(/\bw-full\b.*\bsm:max-w-\[380px\]/);
    expect(classOf(html, "sheet-content")).toContain("motion-reduce:animate-none!");
  });

  it.each(["right", "left"] as const)("HTML del panel abierto: %s", (side) => {
    expect(markup(sheet(side))).toMatchSnapshot();
  });
});

// Diseno de ventanas (propuesta del responsable, 2026-11-20): panel de tarjeta con textura y
// borde de acero, ventana de 480 px y alto maximo min(640px, 86vh), panel lateral de 380 px,
// encabezado y pie con 22 px de relleno lateral, titulo de 17 px en la letra normal y subtitulo
// de 12,5 px. La ventana aparece y sube 8 px desde el 98 %; el panel entra desde su lado en
// --motion-slow; las dos con la curva que se asienta.
function clases(html: string, slot: string) {
  return classOf(html, slot).replaceAll("&amp;", "&").split(" ");
}

describe("ventanas con el diseno de la propuesta", () => {
  const ventana = render(
    h(Dialog, null, trigger, h(DialogContent, null,
      h(DialogHeader, null, h(DialogTitle, null, "Registrar pago"), h(DialogDescription, null, "Pedido PED00000099")),
      h(DialogBody, null, "Cuerpo"),
      h(DialogFooter, null, h(Button, { type: "button" }, "Registrar pago")),
    )),
  );
  const panel = render(
    h(Sheet, null, h(SheetTrigger, null, "Filtros"), h(SheetContent, { "aria-describedby": undefined },
      h(SheetHeader, null, h(SheetTitle, null, "Filtros")),
      h(SheetBody, null, "Cuerpo"),
      h(SheetFooter, null, h(Button, { type: "button" }, "Aplicar")),
    )),
  );

  it("la ventana es una tarjeta con textura, borde de acero, 480 px y alto de min(640px, 86vh)", () => {
    const contenido = clases(ventana, "dialog-content");

    expect(contenido).toEqual(
      expect.arrayContaining([
        "bg-card",
        "bg-(image:--texture-metal)",
        "sm:border-control-border",
        "sm:max-w-[480px]",
        "sm:max-h-[min(640px,86vh)]",
      ]),
    );
    expect(contenido.filter((name) => name.startsWith("bg-linear") || name.startsWith("from-"))).toEqual([]);
  });

  it("la ventana aparece subiendo 8 px desde el 98 % con la curva que se asienta", () => {
    expect(clases(ventana, "dialog-content")).toEqual(
      expect.arrayContaining(["data-open:slide-in-from-bottom-2", "sm:data-open:zoom-in-98", "ease-(--ease-settle)"]),
    );
  });

  it("encabezado, cuerpo y pie con 22 px de relleno lateral y el borde comun", () => {
    expect(clases(ventana, "dialog-header")).toEqual(expect.arrayContaining(["px-[22px]", "py-5", "border-border"]));
    expect(clases(ventana, "dialog-body")).toEqual(expect.arrayContaining(["px-[22px]", "py-5"]));
    expect(clases(ventana, "dialog-footer")).toEqual(expect.arrayContaining(["px-[22px]", "gap-2.5", "border-border"]));
    expect(clases(ventana, "dialog-header")).not.toContain("border-border/80");
  });

  it("titulo de 17 px en seminegrita con la letra normal, subtitulo de 12,5 px", () => {
    expect(clases(ventana, "dialog-title")).toEqual(expect.arrayContaining(["text-[1.0625rem]", "font-semibold"]));
    expect(clases(ventana, "dialog-title")).not.toContain("font-heading");
    expect(clases(ventana, "dialog-description")).toContain("text-[0.78125rem]");
  });

  it("la X es un boton ghost atenuado", () => {
    expect(tag(ventana, /<button [^>]*aria-label="Cerrar"[^>]*>/)).toMatch(/class="[^"]*\btext-muted-foreground\b/);
  });

  it("el panel lateral mide 380 px, lleva el borde de acero y entra en --motion-slow", () => {
    expect(clases(panel, "sheet-content")).toEqual(
      expect.arrayContaining(["sm:max-w-[380px]", "sm:border-control-border", "duration-(--motion-slow)", "ease-(--ease-settle)"]),
    );
  });
});
