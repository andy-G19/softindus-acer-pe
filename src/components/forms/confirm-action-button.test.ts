// @vitest-environment jsdom
import { act, createElement as h, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmActionButton } from "@/components/forms/confirm-action-button";
import type { FormActionState } from "@/lib/action-result";

// Accion de fila con confirmacion (entrega 10), con el Radix real. La accion
// corre en startTransition y su pendiente bloquea la confirmacion hasta que
// responde; con exito, un aviso y se cierra; con error, el mensaje queda
// dentro. Sin confirm (activar), el boton ejecuta la accion directamente.

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

const confirmation = () => document.querySelector('[role="alertdialog"]');

type State = FormActionState<{ id: string }, { estado: boolean }>;

const DEACTIVATED = { type: "warning" as const, message: "Tipo de proveedor desactivado" };
const ACTIVATED = { type: "success" as const, message: "Tipo de proveedor activado" };

function success(): State {
  return { status: "success", data: { estado: false }, values: { id: "TPR00000003" }, operationId: crypto.randomUUID() };
}

function failure(message: string): State {
  return { status: "error", error: message, values: { id: "TPR00000003" }, operationId: crypto.randomUUID() };
}

// Una accion que espera hasta que la prueba la deje terminar.
function deferredAction() {
  let respond: (state: State) => void = () => {};
  const action = vi.fn<(prevState: State, formData: FormData) => Promise<State>>(
    () =>
      new Promise<State>((resolve) => {
        respond = resolve;
      }),
  );
  return { action, respond: (state: State) => respond(state) };
}

async function renderDeactivate(action: (prev: State, formData: FormData) => Promise<State>) {
  await act(async () =>
    root.render(
      h(
        ConfirmActionButton<{ id: string }, { estado: boolean }>,
        {
          action,
          fields: { id_tipo_proveedor: "TPR00000003", estado: "false" },
          variant: "destructive",
          successNotification: DEACTIVATED,
          confirm: {
            title: "¿Inactivar el tipo de proveedor Distribuidor?",
            description: "Dejará de aparecer al registrar proveedores.",
            confirmText: "Inactivar tipo",
          },
          pendingText: "Inactivando...",
          children: "Inactivar",
        },
      ),
    ),
  );
}

describe("ConfirmActionButton con confirmacion", () => {
  it("el boton abre la confirmacion con la entidad, sin ejecutar nada", async () => {
    const { action } = deferredAction();
    await renderDeactivate(action);
    expect(confirmation()).toBeNull();

    await act(async () => button("Inactivar").click());

    expect(confirmation()?.textContent).toContain("¿Inactivar el tipo de proveedor Distribuidor?");
    expect(confirmation()?.textContent).toContain("Dejará de aparecer al registrar proveedores.");
    expect(action).not.toHaveBeenCalled();
  });

  it("Cancelar cierra sin ejecutar la accion y devuelve el foco al boton", async () => {
    const { action } = deferredAction();
    await renderDeactivate(action);
    const trigger = button("Inactivar");
    trigger.focus();
    await act(async () => trigger.click());

    await act(async () => button("Cancelar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(action).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it("confirmar envia los campos una sola vez y bloquea la ventana hasta la respuesta", async () => {
    const { action, respond } = deferredAction();
    await renderDeactivate(action);
    await act(async () => button("Inactivar").click());

    const verb = button("Inactivar tipo");
    await act(async () => verb.click());
    await act(async () => button("Inactivando...").click());

    expect(action).toHaveBeenCalledTimes(1);
    const formData = action.mock.calls[0][1];
    expect(Object.fromEntries(formData)).toEqual({ id_tipo_proveedor: "TPR00000003", estado: "false" });
    expect(button("Cancelar").disabled).toBe(true);
    expect(button("Inactivando...").getAttribute("aria-busy")).toBe("true");

    await act(async () => document.querySelector('[role="alertdialog"]')!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ));
    expect(confirmation()).not.toBeNull();

    await act(async () => respond(success()));
    await settle();
  });

  it("con exito da un solo aviso, se cierra y devuelve el foco al boton", async () => {
    const { action, respond } = deferredAction();
    await renderDeactivate(action);
    const trigger = button("Inactivar");
    trigger.focus();
    await act(async () => trigger.click());
    await act(async () => button("Inactivar tipo").click());

    await act(async () => respond(success()));
    await settle();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(DEACTIVATED);
    expect(confirmation()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("con error queda abierta con el mensaje dentro, sin aviso; al cancelar y reabrir ya no esta", async () => {
    const { action, respond } = deferredAction();
    await renderDeactivate(action);
    await act(async () => button("Inactivar").click());
    await act(async () => button("Inactivar tipo").click());

    await act(async () => respond(failure("El tipo de proveedor ya estaba inactivo.")));
    await settle();

    expect(confirmation()).not.toBeNull();
    expect(confirmation()!.querySelector('[role="alert"]')?.textContent).toBe("El tipo de proveedor ya estaba inactivo.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(button("Cancelar").disabled).toBe(false);

    await act(async () => button("Cancelar").click());
    await settle();
    await act(async () => button("Inactivar").click());

    expect(confirmation()!.querySelector('[role="alert"]')).toBeNull();
  });
});

describe("ConfirmActionButton sin confirmacion", () => {
  async function renderActivate(action: (prev: State, formData: FormData) => Promise<State>) {
    await act(async () =>
      root.render(
        h(
          ConfirmActionButton<{ id: string }, { estado: boolean }>,
          {
            action,
            fields: { id_tipo_proveedor: "TPR00000003", estado: "true" },
            variant: "ghost",
            successNotification: ACTIVATED,
            pendingText: "Activando...",
            children: "Activar",
          },
        ),
      ),
    );
  }

  it("ejecuta la accion al pulsar, sin ventana, y queda pendiente hasta la respuesta", async () => {
    const { action, respond } = deferredAction();
    await renderActivate(action);

    await act(async () => button("Activar").click());
    await act(async () => button("Activando...").click());

    expect(confirmation()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
    expect(button("Activando...").getAttribute("aria-disabled")).toBe("true");

    await act(async () => respond(success()));
    await settle();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
    expect(button("Activar").getAttribute("aria-disabled")).toBeNull();
  });

  it("un error sale como aviso de error", async () => {
    const { action, respond } = deferredAction();
    await renderActivate(action);

    await act(async () => button("Activar").click());
    await act(async () => respond(failure("No tienes permisos para gestionar tipos de proveedor.")));
    await settle();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({
      type: "error",
      message: "No tienes permisos para gestionar tipos de proveedor.",
    });
  });
});

// Hallazgo 13 de la 10.3a: cuando la accion termina, la lista se vuelve a pintar
// con los datos nuevos y el boton puede desaparecer: atender una alerta deja la
// fila sin la accion, e inactivar con el filtro «Activo» (o activar con
// «Inactivo») saca la fila del listado. El foco no debe quedar en body: va a la
// fila, si sigue, o a la tabla. Si el boton sigue (Inactivar pasa a Activar),
// se queda en el. Next puede aplicar la lista nueva con la confirmacion
// todavia abierta o despues de cerrarla: se prueban los dos ordenes.
describe("ConfirmActionButton cuando su boton desaparece de la lista", () => {
  type Item = { id: string; estado: boolean };

  const controls: { setItems: (items: Item[]) => void } = { setItems: () => {} };

  // Una tabla con una accion por fila. Con withConfirm, inactivar confirma y
  // activar no, como las filas de estado; sin el, solo hay accion mientras la
  // fila esta activa, como atender una alerta.
  function ItemTable({
    initial,
    action,
    swaps = false,
  }: {
    initial: Item[];
    action: (prev: State, formData: FormData) => Promise<State>;
    swaps?: boolean;
  }) {
    const [items, setItems] = useState(initial);
    controls.setItems = setItems;

    return h(
      "table",
      { "data-testid": "tabla" },
      h(
        "tbody",
        null,
        items.map((item) =>
          h(
            "tr",
            { key: item.id, "data-id": item.id },
            h("td", null, item.id),
            h(
              "td",
              null,
              item.estado
                ? h(ConfirmActionButton<{ id: string }, { estado: boolean }>, {
                    action,
                    fields: { id: item.id, estado: "false" },
                    successNotification: DEACTIVATED,
                    confirm: { title: `¿Inactivar ${item.id}?`, description: "Consecuencia.", confirmText: "Confirmar" },
                    children: "Inactivar",
                  })
                : swaps
                  ? h(ConfirmActionButton<{ id: string }, { estado: boolean }>, {
                      action,
                      fields: { id: item.id, estado: "true" },
                      successNotification: ACTIVATED,
                      children: "Activar",
                    })
                  : "-",
            ),
          ),
        ),
      ),
    );
  }

  const row = (id: string) => document.querySelector<HTMLElement>(`tr[data-id="${id}"]`);
  const table = () => document.querySelector<HTMLElement>('[data-testid="tabla"]');
  const triggerIn = (id: string) => row(id)!.querySelector<HTMLButtonElement>("button")!;

  // Con la confirmacion abierta: la accion cambia la lista antes de responder.
  function updatesBeforeResponding(next: () => Item[]) {
    return vi.fn(async () => {
      controls.setItems(next());
      return success();
    });
  }

  async function confirmIn(id: string) {
    const trigger = triggerIn(id);
    trigger.focus();
    await act(async () => trigger.click());
    await act(async () => button("Confirmar").click());
    await settle();
    await settle();
  }

  it("si la fila sigue sin la accion, el foco va a la fila (atender una alerta)", async () => {
    const action = updatesBeforeResponding(() => [{ id: "A1", estado: false }, { id: "A2", estado: true }]);
    await act(async () => root.render(h(ItemTable, { initial: [{ id: "A1", estado: true }, { id: "A2", estado: true }], action })));

    await confirmIn("A1");

    expect(confirmation()).toBeNull();
    expect(row("A1")!.querySelector("button")).toBeNull();
    expect(document.activeElement).toBe(row("A1"));
    expect(row("A1")!.getAttribute("tabindex")).toBe("-1");

    // Cuando el foco sale de la fila, deja de ser enfocable desde el script.
    triggerIn("A2").focus();
    expect(row("A1")!.hasAttribute("tabindex")).toBe(false);
  });

  it("si la fila sale del listado, el foco va a la tabla (inactivar con el filtro Activo)", async () => {
    const action = updatesBeforeResponding(() => [{ id: "A2", estado: true }]);
    await act(async () => root.render(h(ItemTable, { initial: [{ id: "A1", estado: true }, { id: "A2", estado: true }], action })));

    await confirmIn("A1");

    expect(row("A1")).toBeNull();
    expect(document.activeElement).toBe(table());
    expect(table()!.getAttribute("tabindex")).toBe("-1");
  });

  it("si la lista cambia despues de cerrar la confirmacion, el foco tambien va a la fila", async () => {
    const action = vi.fn(async () => success());
    await act(async () => root.render(h(ItemTable, { initial: [{ id: "A1", estado: true }], action })));

    await confirmIn("A1");
    expect(document.activeElement).toBe(triggerIn("A1"));

    await act(async () => controls.setItems([{ id: "A1", estado: false }]));
    await settle();

    expect(document.activeElement).toBe(row("A1"));
  });

  it("sin confirmacion, si la fila sale del listado, el foco va a la tabla (activar con el filtro Inactivo)", async () => {
    const action = updatesBeforeResponding(() => [{ id: "A2", estado: false }]);
    await act(async () =>
      root.render(h(ItemTable, { initial: [{ id: "A1", estado: false }, { id: "A2", estado: false }], action, swaps: true })),
    );
    const trigger = triggerIn("A1");
    trigger.focus();

    await act(async () => trigger.click());
    await settle();

    expect(row("A1")).toBeNull();
    expect(document.activeElement).toBe(table());
  });

  it("si el boton sigue (Inactivar pasa a Activar), el foco queda en el y no se agrega tabindex", async () => {
    const action = updatesBeforeResponding(() => [{ id: "A1", estado: false }]);
    await act(async () => root.render(h(ItemTable, { initial: [{ id: "A1", estado: true }], action, swaps: true })));
    const trigger = triggerIn("A1");

    await confirmIn("A1");

    expect(triggerIn("A1")).toBe(trigger);
    expect(trigger.textContent).toBe("Activar");
    expect(document.activeElement).toBe(trigger);
    expect(row("A1")!.hasAttribute("tabindex")).toBe(false);
    expect(table()!.hasAttribute("tabindex")).toBe(false);
  });

  it("al cancelar no cambia nada: el foco vuelve al boton", async () => {
    const action = vi.fn(async () => success());
    await act(async () => root.render(h(ItemTable, { initial: [{ id: "A1", estado: true }], action })));
    const trigger = triggerIn("A1");
    trigger.focus();

    await act(async () => trigger.click());
    await act(async () => button("Cancelar").click());
    await settle();

    expect(action).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
    expect(row("A1")!.hasAttribute("tabindex")).toBe(false);
  });

  it("si la lista cambia sin que el boton tuviera el foco, no lo mueve", async () => {
    const action = vi.fn(async () => success());
    await act(async () => root.render(h(ItemTable, { initial: [{ id: "A1", estado: true }, { id: "A2", estado: true }], action })));
    const other = triggerIn("A2");
    other.focus();

    await act(async () => controls.setItems([{ id: "A2", estado: true }]));
    await settle();

    expect(document.activeElement).toBe(other);
  });

  it("si la lista cambia con el foco en body (tras un clic en una zona vacia), no lo lleva a la tabla", async () => {
    const action = vi.fn(async () => success());
    await act(async () => root.render(h(ItemTable, { initial: [{ id: "A1", estado: true }, { id: "A2", estado: true }], action })));
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.activeElement).toBe(document.body);

    await act(async () => controls.setItems([{ id: "A2", estado: true }]));
    await settle();

    expect(document.activeElement).toBe(document.body);
    expect(table()!.hasAttribute("tabindex")).toBe(false);
  });
});
