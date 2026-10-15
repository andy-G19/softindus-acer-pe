// @vitest-environment jsdom
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/notifications/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ConfirmDialog controlada con el Radix real (entrega 9): descartar los cambios
// de un formulario abierto en una ventana. La confirmacion se apila sobre la
// ventana; Cancelar vuelve a la ventana con el foco donde estaba y Descartar
// cierra las dos. Esc con teclas reales se prueba en la galeria.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom no trae ResizeObserver y DialogBody lo usa (hallazgo K4); aqui no se
// prueba el tamano, basta con que exista.
class ResizeObserverDouble {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

// FocusScope devuelve el foco en un setTimeout(0) al desmontarse.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function byText(text: string) {
  const element = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === text,
  );
  if (!element) {
    throw new Error(`No hay ningun boton "${text}"`);
  }
  return element;
}

const alertDialog = () => document.querySelector('[role="alertdialog"]');
const dialog = () => document.querySelector('[role="dialog"]');

function EditWindow({ onDiscard }: { onDiscard: () => void | Promise<void> }) {
  const [windowOpen, setWindowOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return h(
    "div",
    null,
    h(
      Dialog,
      { open: windowOpen, onOpenChange: (next: boolean) => (next ? setWindowOpen(true) : setConfirmOpen(true)) },
      h(
        DialogContent,
        null,
        h(DialogHeader, null, h(DialogTitle, null, "Editar cliente"), h(DialogDescription, null, "CLI00000001")),
        h(DialogBody, null, h("input", { id: "nombre", name: "nombre", defaultValue: "Andina" })),
        h(DialogFooter, null, h(Button, { type: "button", variant: "outline", onClick: () => setConfirmOpen(true) }, "Cancelar edicion")),
      ),
    ),
    h(ConfirmDialog, {
      open: confirmOpen,
      onOpenChange: setConfirmOpen,
      title: "¿Descartar los cambios del cliente?",
      description: "Se perderan los datos que escribiste en esta ventana.",
      confirmText: "Descartar cambios",
      variant: "destructive",
      onConfirm: async () => {
        await onDiscard();
        setWindowOpen(false);
      },
    }),
  );
}

describe("ConfirmDialog controlada sobre una ventana", () => {
  it("se abre sin disparador sobre la ventana, con el foco en Cancelar", async () => {
    await act(async () => root.render(h(EditWindow, { onDiscard: () => {} })));
    expect(alertDialog()).toBeNull();

    await act(async () => byText("Cancelar edicion").click());

    expect(alertDialog()).not.toBeNull();
    expect(dialog()).not.toBeNull();
    expect(document.activeElement).toBe(byText("Cancelar"));
  });

  it("Cancelar cierra solo la confirmacion y devuelve el foco a la ventana", async () => {
    const onDiscard = vi.fn();
    await act(async () => root.render(h(EditWindow, { onDiscard })));
    const opener = byText("Cancelar edicion");
    opener.focus();

    await act(async () => opener.click());
    await act(async () => byText("Cancelar").click());
    await settle();

    expect(alertDialog()).toBeNull();
    expect(dialog()).not.toBeNull();
    expect(onDiscard).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it("Descartar ejecuta la accion y cierra la confirmacion y la ventana", async () => {
    const onDiscard = vi.fn();
    await act(async () => root.render(h(EditWindow, { onDiscard })));

    await act(async () => byText("Cancelar edicion").click());
    await act(async () => byText("Descartar cambios").click());
    await settle();

    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(alertDialog()).toBeNull();
    expect(dialog()).toBeNull();
  });

  it("mientras la accion espera, Cancelar esta deshabilitado y la accion conserva el foco", async () => {
    let finish: () => void = () => {};
    const onDiscard = () => new Promise<void>((resolve) => (finish = resolve));
    await act(async () => root.render(h(EditWindow, { onDiscard })));

    await act(async () => byText("Cancelar edicion").click());
    const action = byText("Descartar cambios");
    action.focus();
    await act(async () => action.click());

    expect(byText("Cancelar").disabled).toBe(true);
    expect(action.getAttribute("aria-busy")).toBe("true");
    expect(document.activeElement).toBe(action);

    await act(async () => finish());
    await settle();
    expect(alertDialog()).toBeNull();
  });
});
