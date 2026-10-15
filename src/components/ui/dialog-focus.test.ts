// @vitest-environment jsdom
import { act, createElement as h, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

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

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", heightFromAttribute("data-test-scroll-height"));
  Object.defineProperty(HTMLElement.prototype, "clientHeight", heightFromAttribute("data-test-client-height"));
});

afterAll(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
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
