// @vitest-environment jsdom
import { act, createElement as h } from "react";
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
