// @vitest-environment jsdom
import { act, createElement as h, useEffect, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FormDialog } from "@/components/forms/form-dialog";
import { useFormResult, useFormSurface } from "@/components/forms/form-surface";
import { Button } from "@/components/ui/button";
import type { FormActionState } from "@/lib/action-result";

// Ventana modal con formulario (entrega 10) y los efectos del resultado, con
// el Radix real. FormDialog y RouteSheet comparten el guardian de descarte:
// las pruebas del panel siguen en route-sheet.test.ts; aqui, la ventana modal
// y useFormResult fuera de cualquier ventana.

const notifications = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverDouble {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
  notifications.notify.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function button(text: string) {
  const element = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  if (!element) {
    throw new Error(`No hay boton "${text}"`);
  }
  return element;
}

const dialog = () => document.querySelector('[role="dialog"]');
const confirmation = () => document.querySelector('[role="alertdialog"]');
const closeX = () => document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!;

async function type(text: string) {
  const input = document.querySelector<HTMLInputElement>("#nombre")!;
  input.value = text;
  await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));
}

// Lo que hace el mousedown sobre algo que no recibe el foco: se lo quita al
// campo y queda en body.
function loseFocus() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}

// Clic sobre el velo, con la secuencia del navegador: pointerdown, mousedown
// (el foco pasa a body), mouseup y click. Radix cierra la ventana modal en el
// click, asi que la confirmacion de descarte se abre con el foco en body.
async function clickOutside() {
  // Radix empieza a escuchar el pointerdown fuera tras un setTimeout(0).
  await settle();
  const page = document.documentElement;
  await act(async () => {
    page.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
    loseFocus();
    page.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    page.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
    page.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  });
  await settle();
}

// Un formulario que usa los controles de la ventana, como lo hacen los reales.
function Controls({ busy = false }: { busy?: boolean }) {
  const surface = useFormSurface();

  useEffect(() => {
    surface?.setBusy(busy);
  }, [surface, busy]);

  return h(
    "div",
    null,
    h("input", { id: "nombre", name: "nombre", defaultValue: "" }),
    h("input", { id: "slug", name: "slug", defaultValue: "" }),
    h("button", { type: "button", onClick: () => surface?.requestClose() }, "Cancelar formulario"),
    h("button", { type: "button", onClick: () => surface?.closeAfterSave() }, "Simular guardado"),
  );
}

// Un campo que desaparece mientras la confirmacion esta abierta, como cuando
// ActionForm remonta los campos al llegar un resultado.
function RemovableSlug({ onReady }: { onReady: (remove: () => void) => void }) {
  const [slugShown, setSlugShown] = useState(true);

  useEffect(() => {
    onReady(() => setSlugShown(false));
  }, [onReady]);

  return h(
    "div",
    null,
    h("input", { id: "nombre", name: "nombre", defaultValue: "" }),
    slugShown ? h("input", { id: "slug", name: "slug", defaultValue: "" }) : null,
  );
}

async function renderDialog({
  busy = false,
  description,
  content,
}: { busy?: boolean; description?: string; content?: ReactNode } = {}) {
  await act(async () =>
    root.render(
      h(FormDialog, {
        trigger: h(Button, { type: "button" }, "Nuevo tipo"),
        title: "Nuevo tipo de proveedor",
        description,
        discardTitle: "¿Descartar el tipo de proveedor?",
        discardDescription: "Se perderán los datos que escribiste en esta ventana.",
        children: content ?? h(Controls, { busy }),
      }),
    ),
  );
}

async function open() {
  const trigger = button("Nuevo tipo");
  trigger.focus();
  await act(async () => trigger.click());
  return trigger;
}

describe("FormDialog", () => {
  it("la abre su boton, con el titulo y el foco en el primer campo", async () => {
    await renderDialog();
    expect(dialog()).toBeNull();

    await open();

    expect(dialog()?.textContent).toContain("Nuevo tipo de proveedor");
    expect(document.activeElement?.id).toBe("nombre");
  });

  it("asocia la descripcion solo si la tiene", async () => {
    await renderDialog({ description: "TPR00000003" });
    await open();
    const describedBy = dialog()!.getAttribute("aria-describedby");

    expect(document.getElementById(describedBy!)?.textContent).toBe("TPR00000003");

    await act(async () => closeX().click());
    await settle();
    await renderDialog();
    await open();

    expect(dialog()!.hasAttribute("aria-describedby")).toBe(false);
  });

  it("sin cambios, cerrar no pregunta y devuelve el foco al boton", async () => {
    await renderDialog();
    const trigger = await open();

    await act(async () => closeX().click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("con cambios, cerrar pide confirmar: Cancelar sigue en la ventana y Descartar la cierra", async () => {
    await renderDialog();
    await open();
    await type("Distribuidor");

    await act(async () => button("Cancelar formulario").click());
    expect(confirmation()?.textContent).toContain("¿Descartar el tipo de proveedor?");

    await act(async () => button("Cancelar").click());
    await settle();
    expect(confirmation()).toBeNull();
    expect(dialog()).not.toBeNull();
    expect(document.querySelector<HTMLInputElement>("#nombre")!.value).toBe("Distribuidor");

    await act(async () => closeX().click());
    await act(async () => button("Descartar cambios").click());
    await settle();
    expect(dialog()).toBeNull();
  });

  it("al reabrirla empieza sin cambios pendientes", async () => {
    await renderDialog();
    await open();
    await type("Distribuidor");
    await act(async () => closeX().click());
    await act(async () => button("Descartar cambios").click());
    await settle();

    await open();
    await act(async () => closeX().click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(dialog()).toBeNull();
  });

  it("mientras el formulario esta ocupado no se cierra", async () => {
    await renderDialog({ busy: true });
    await open();
    await type("Distribuidor");

    await act(async () => closeX().click());
    await act(async () => button("Cancelar formulario").click());

    expect(confirmation()).toBeNull();
    expect(dialog()).not.toBeNull();
  });

  it("tras guardar se cierra sin preguntar aunque haya cambios", async () => {
    await renderDialog();
    const trigger = await open();
    await type("Distribuidor");

    await act(async () => button("Simular guardado").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("con cambios, recargar o salir de la pagina pide confirmacion al navegador", async () => {
    await renderDialog();
    await open();
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    await type("Distribuidor");
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);

    expect(dirty.defaultPrevented).toBe(true);
  });

  it("tras guardar o descartar, recargar ya no pide confirmacion aunque la ventana siga montada", async () => {
    await renderDialog();
    await open();
    await type("Distribuidor");
    await act(async () => button("Simular guardado").click());
    await settle();

    const afterSave = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterSave);
    expect(afterSave.defaultPrevented).toBe(false);

    await open();
    await type("Otro tipo");
    await act(async () => closeX().click());
    await act(async () => button("Descartar cambios").click());
    await settle();

    const afterDiscard = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(afterDiscard);
    expect(afterDiscard.defaultPrevented).toBe(false);
  });
});

// Hallazgo 8 de la 10.1: la confirmacion de descarte devolvia el foco al
// elemento que lo tenia al abrirse, y tras un clic fuera ese elemento es body.
// Ahora lo devuelve al ultimo elemento que tuvo el foco dentro de la ventana.
describe("FormDialog: el foco al cancelar el descarte", () => {
  it("tras un clic fuera con cambios, Cancelar devuelve el foco al ultimo campo enfocado", async () => {
    await renderDialog();
    await open();
    const slug = document.querySelector<HTMLInputElement>("#slug")!;
    slug.focus();
    await type("Distribuidor");

    await clickOutside();
    expect(confirmation()?.textContent).toContain("¿Descartar el tipo de proveedor?");
    expect(document.activeElement).toBe(button("Cancelar"));

    await act(async () => button("Cancelar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(dialog()).not.toBeNull();
    expect(document.activeElement).toBe(slug);
  });

  it("si pulsar Cancelar del formulario no le da el foco (asi lo hace Safari), tambien vuelve al ultimo campo", async () => {
    await renderDialog();
    await open();
    const slug = document.querySelector<HTMLInputElement>("#slug")!;
    slug.focus();
    await type("Distribuidor");

    loseFocus();
    await act(async () => button("Cancelar formulario").click());
    await act(async () => button("Cancelar").click());
    await settle();

    expect(document.activeElement).toBe(slug);
  });

  it("si el ultimo campo enfocado ya no existe, el foco vuelve a la ventana", async () => {
    let removeSlug = () => {};
    await renderDialog({ content: h(RemovableSlug, { onReady: (remove) => (removeSlug = remove) }) });
    await open();
    document.querySelector<HTMLInputElement>("#slug")!.focus();
    await type("Distribuidor");

    await clickOutside();
    await act(async () => removeSlug());
    expect(document.querySelector("#slug")).toBeNull();
    await act(async () => button("Cancelar").click());
    await settle();

    expect(document.activeElement).toBe(dialog());
  });

  it("tras un clic fuera con cambios, Descartar cierra la ventana y devuelve el foco al boton", async () => {
    await renderDialog();
    const trigger = await open();
    await type("Distribuidor");

    await clickOutside();
    await act(async () => button("Descartar cambios").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

type DemoState = FormActionState<{ nombre: string }, { id: string }>;

const SAVED = { type: "success" as const, message: "Registro creado correctamente" };

function success(operationId: string): DemoState {
  return { status: "success", data: { id: "TPR00000003" }, values: { nombre: "Distribuidor" }, operationId };
}

function ResultProbe({ state, pending, onSuccess }: { state: DemoState; pending: boolean; onSuccess: () => void }) {
  useFormResult(state, pending, { successNotification: SAVED, onSuccess });
  return null;
}

describe("useFormResult en una pagina completa", () => {
  it("con exito da un aviso y llama a onSuccess; con error, ninguno", async () => {
    const onSuccess = vi.fn();
    const failed: DemoState = { status: "error", error: "Revisa los datos.", values: { nombre: "" }, operationId: "op-1" };

    await act(async () => root.render(h(ResultProbe, { state: failed, pending: false, onSuccess })));
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();

    await act(async () => root.render(h(ResultProbe, { state: success("op-2"), pending: false, onSuccess })));
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(SAVED);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("un solo aviso por operacion aunque cambien onSuccess o el pendiente", async () => {
    const state = success("op-3");
    const first = vi.fn();
    const second = vi.fn();

    await act(async () => root.render(h(ResultProbe, { state, pending: false, onSuccess: first })));
    await act(async () => root.render(h(ResultProbe, { state, pending: true, onSuccess: second })));

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("dos operaciones iguales seguidas dan dos avisos", async () => {
    const onSuccess = vi.fn();

    await act(async () => root.render(h(ResultProbe, { state: success("op-4"), pending: false, onSuccess })));
    await act(async () => root.render(h(ResultProbe, { state: success("op-5"), pending: false, onSuccess })));

    expect(notifications.notify).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(2);
  });
});
