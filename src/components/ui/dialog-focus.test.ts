// @vitest-environment jsdom
import { act, createElement as h, useLayoutEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Foco de Dialog y Sheet con el Radix real, sin el doble de dialog.test.ts. El
// foco inicial lo elige la trampa de foco de Radix en un efecto, y
// renderToStaticMarkup no ejecuta efectos ni tiene foco: por eso este archivo
// corre en jsdom. jsdom no calcula el layout, asi que el alto del contenido y
// el alto visible de un elemento se fijan con data-test-scroll-height y
// data-test-client-height. Esc, la devolucion del foco y el teclado real se
// prueban a mano en la galeria.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function heightFromAttribute(name: string): PropertyDescriptor {
  return {
    configurable: true,
    get(this: HTMLElement) {
      return Number(this.getAttribute(name) ?? 0);
    },
  };
}

// jsdom no trae ResizeObserver: el doble guarda cada observador para que una
// prueba simule un cambio de tamano.
let resizeObservers: ResizeObserverDouble[] = [];

class ResizeObserverDouble {
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObservers.push(this);
  }

  observe() {}

  unobserve() {}

  disconnect() {
    resizeObservers = resizeObservers.filter((observer) => observer !== this);
  }
}

function resizeAll() {
  for (const observer of [...resizeObservers]) {
    observer.callback([], observer as unknown as ResizeObserver);
  }
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", heightFromAttribute("data-test-scroll-height"));
  Object.defineProperty(HTMLElement.prototype, "clientHeight", heightFromAttribute("data-test-client-height"));
  vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
});

afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
  vi.unstubAllGlobals();
});

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function open(node: ReactNode) {
  await act(async () => {
    root.render(node);
  });
}

// Solo los bordes: la trampa de Radix mueve el foco con Tab desde el ultimo
// tabulable y con Mayus+Tab desde el primero; entre medias, el Tab lo hace el
// navegador, que jsdom no simula.
async function pressTab(options: { shiftKey?: boolean } = {}) {
  const target = document.activeElement ?? document.body;
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true, ...options }));
  });
}

function slot(name: string) {
  const element = document.querySelector<HTMLElement>(`[data-slot="${name}"]`);
  if (!element) {
    throw new Error(`No hay ningun elemento ${name}`);
  }
  return element;
}

// Atributos data-*: los tipos de React solo los aceptan en JSX, no en un
// objeto literal pasado a createElement.
type LayoutAttributes = Record<string, string>;

// Cuerpo con mas contenido que alto visible (desplazable) y sin desborde.
const overflowing: LayoutAttributes = { "data-test-scroll-height": "900", "data-test-client-height": "400" };
const fitting: LayoutAttributes = { "data-test-scroll-height": "200", "data-test-client-height": "400" };

function dialog(bodyProps: LayoutAttributes, ...children: ReactNode[]) {
  return h(
    Dialog,
    { open: true },
    h(
      DialogContent,
      null,
      h(DialogHeader, null, h(DialogTitle, null, "Detalle del pedido"), h(DialogDescription, null, "PED00000099")),
      h(DialogBody, { ...bodyProps }, ...children),
      h(
        DialogFooter,
        null,
        h(DialogClose, { asChild: true }, h(Button, { type: "button", variant: "outline" }, "Cerrar")),
      ),
    ),
  );
}

const paymentFields = [
  h("label", { key: "monto-label", htmlFor: "monto" }, "Monto"),
  h(Input, { key: "monto", id: "monto", name: "monto" }),
  h("label", { key: "medio-label", htmlFor: "medio" }, "Medio de pago"),
  h(NativeSelect, { key: "medio", id: "medio", name: "medio" }, h("option", { value: "efectivo" }, "Efectivo")),
];

const footerButton = () => slot("dialog-footer").querySelector("button");
const closeX = () => document.querySelector('button[aria-label="Cerrar"]');

describe("foco inicial de Dialog con Radix real", () => {
  it("con formulario va al primer campo, aunque el cuerpo desborde", async () => {
    await open(dialog(overflowing, ...paymentFields));

    expect(document.activeElement).toBe(document.getElementById("monto"));
    expect(slot("dialog-body").hasAttribute("tabindex")).toBe(false);
  });

  it("sin campos y sin desborde va al primer boton del pie", async () => {
    await open(dialog(fitting, h("p", null, "El pedido no tiene observaciones.")));

    expect(document.activeElement).toBe(footerButton());
    expect(slot("dialog-body").hasAttribute("tabindex")).toBe(false);
  });
});

describe("foco inicial de Sheet con Radix real", () => {
  it("con campos va al primer campo", async () => {
    await open(
      h(
        Sheet,
        { open: true },
        h(
          SheetContent,
          { "aria-describedby": undefined },
          h(SheetHeader, null, h(SheetTitle, null, "Filtros")),
          h(SheetBody, { ...overflowing }, ...paymentFields),
        ),
      ),
    );

    expect(document.activeElement).toBe(document.getElementById("monto"));
    expect(slot("dialog-body").hasAttribute("tabindex")).toBe(false);
  });

  it("con solo enlaces va a la X: Radix no da el foco inicial a un enlace, pero el enlace es tabulable", async () => {
    await open(
      h(
        Sheet,
        { open: true },
        h(
          SheetContent,
          { side: "left", "aria-describedby": undefined },
          h(SheetHeader, null, h(SheetTitle, null, "Menu")),
          h(
            SheetBody,
            { ...overflowing },
            h("nav", { "aria-label": "Menu" }, h("a", { href: "#clientes" }, "Clientes"), h("a", { href: "#pedidos" }, "Pedidos")),
          ),
        ),
      ),
    );

    expect(document.activeElement).toBe(closeX());
    expect(slot("dialog-body").hasAttribute("tabindex")).toBe(false);
  });
});

// Hallazgo K4 de la entrega 8: un cuerpo desplazable sin nada enfocable quedaba
// fuera de la trampa de foco de Radix, que solo cuenta los elementos con
// tabIndex >= 0; no se alcanzaba con Tab ni se desplazaba con el teclado
// (WCAG 2.1.1).
const orderLines = Array.from({ length: 24 }, (_, index) =>
  h("p", { key: index }, `PRD${String(index + 1).padStart(8, "0")} Plancha de acero ${index + 1}`),
);

// Lee el tabIndex del cuerpo en su propio efecto de layout, despues del de
// DialogBody (los efectos de hermanos corren en orden) y antes de cualquier
// efecto pasivo, como el que usa Radix para el foco inicial.
function TabIndexAtLayout({ onRead }: { onRead: (tabIndex: number) => void }) {
  useLayoutEffect(() => {
    onRead(slot("dialog-body").tabIndex);
  }, [onRead]);
  return null;
}

describe("cuerpo desplazable sin enfocables (hallazgo K4)", () => {
  it("entra en el orden de Tab y recibe el foco inicial", async () => {
    await open(dialog(overflowing, ...orderLines));

    expect(slot("dialog-body").tabIndex).toBe(0);
    expect(document.activeElement).toBe(slot("dialog-body"));
  });

  it("la trampa lo cuenta: Mayus+Tab desde el cuerpo va a la X y Tab desde la X vuelve al cuerpo", async () => {
    await open(dialog(overflowing, ...orderLines));

    await pressTab({ shiftKey: true });
    expect(document.activeElement).toBe(closeX());

    await pressTab();
    expect(document.activeElement).toBe(slot("dialog-body"));
  });

  it("el tabIndex ya esta al terminar la fase de layout del montaje, antes del foco inicial de Radix", async () => {
    const read = vi.fn();

    await open(
      h(
        Dialog,
        { open: true },
        h(
          DialogContent,
          { "aria-describedby": undefined },
          h(DialogHeader, null, h(DialogTitle, null, "Detalle del pedido")),
          h(DialogBody, { ...overflowing }, ...orderLines),
          h(TabIndexAtLayout, { onRead: read }),
        ),
      ),
    );

    expect(read).toHaveBeenNthCalledWith(1, 0);
  });

  it("no cuentan como enfocables un boton deshabilitado, uno oculto, uno sin visibilidad, uno sin mostrar ni un input oculto", async () => {
    // El boton con hidden lleva un display que lo mostraria: la hoja base ya le
    // pone display none, y asi la prueba fija la regla de Radix, que lo salta
    // por hidden. Al input oculto ningun estilo lo muestra (display none
    // !important en la hoja base del estandar HTML).
    await open(
      dialog(
        overflowing,
        ...orderLines,
        h(Button, { key: "deshabilitado", type: "button", disabled: true }, "Deshabilitado"),
        h(Button, { key: "oculto", type: "button", hidden: true, style: { display: "inline-flex" } }, "Oculto"),
        h(Button, { key: "sin-visibilidad", type: "button", style: { visibility: "hidden" } }, "Sin visibilidad"),
        h("div", { key: "sin-mostrar", style: { display: "none" } }, h(Button, { type: "button" }, "Sin mostrar")),
        h("input", { key: "id", type: "hidden", name: "id", defaultValue: "PED00000099" }),
      ),
    );

    expect(slot("dialog-body").tabIndex).toBe(0);
    expect(document.activeElement).toBe(slot("dialog-body"));
  });

  it("sale del orden de Tab cuando aparece un campo y vuelve cuando se va", async () => {
    await open(dialog(overflowing, ...orderLines));
    expect(slot("dialog-body").tabIndex).toBe(0);

    await open(dialog(overflowing, ...orderLines, h(Input, { key: "nota", id: "nota", name: "nota" })));
    expect(slot("dialog-body").hasAttribute("tabindex")).toBe(false);

    await open(dialog(overflowing, ...orderLines));
    expect(slot("dialog-body").tabIndex).toBe(0);
  });

  it("entra en el orden de Tab cuando su unico campo se deshabilita", async () => {
    const field = (disabled: boolean) => h(Input, { key: "nota", id: "nota", name: "nota", disabled });

    await open(dialog(overflowing, ...orderLines, field(false)));
    expect(slot("dialog-body").hasAttribute("tabindex")).toBe(false);

    await open(dialog(overflowing, ...orderLines, field(true)));
    expect(slot("dialog-body").tabIndex).toBe(0);
  });

  it("entra en el orden de Tab cuando un cambio de tamano lo hace desbordar", async () => {
    await open(dialog(fitting, ...orderLines));
    const body = slot("dialog-body");
    expect(body.hasAttribute("tabindex")).toBe(false);

    // Un atributo data-test-* no lo ve el observador de mutaciones: solo el de
    // tamano puede descubrir el desborde.
    body.setAttribute("data-test-client-height", "100");
    await act(async () => resizeAll());

    expect(body.tabIndex).toBe(0);
  });

  it("en Sheet funciona igual: el cuerpo del panel recibe el foco inicial", async () => {
    await open(
      h(
        Sheet,
        { open: true },
        h(
          SheetContent,
          { "aria-describedby": undefined },
          h(SheetHeader, null, h(SheetTitle, null, "Historial del cliente")),
          h(SheetBody, { ...overflowing }, ...orderLines),
        ),
      ),
    );

    expect(slot("dialog-body").tabIndex).toBe(0);
    expect(document.activeElement).toBe(slot("dialog-body"));
  });
});
