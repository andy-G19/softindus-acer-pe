// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { UserStatusActions } from "@/modules/users/user-status-actions";

// Activar y desactivar un usuario desde su fila (entrega 10.7b), con el Radix real.
// Activar se aplica al pulsar; desactivar confirma con el boton destructivo y dice la
// consecuencia real: no puede iniciar sesion y su sesion abierta se corta (D4). El
// administrador no puede desactivarse: su boton queda deshabilitado.

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

const USUARIO = "USU00000002";
const ACTIVATED = { type: "success" as const, message: "Activado" };
const DEACTIVATED = { type: "warning" as const, message: "Desactivado" };

const confirmation = () => document.querySelector('[role="alertdialog"]');

function buttonIn(scope: ParentNode, text: string) {
  const element = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  if (!element) {
    throw new Error(`No hay boton "${text}"`);
  }
  return element;
}

const done = (estado: string): RowStatusState => ({
  status: "success",
  data: { estado },
  values: { id: USUARIO },
  operationId: "op",
});

function actionWith(state: RowStatusState) {
  return vi.fn<(prev: RowStatusState, formData: FormData) => Promise<RowStatusState>>(async () => state);
}

async function renderActions(estado: string, { isSelf = false, action = actionWith(done("inactivo")) } = {}) {
  await act(async () =>
    root.render(
      h(UserStatusActions, {
        user: { id_usuario: USUARIO, nombre: "Ana Quispe", estado },
        isSelf,
        action,
        activatedNotification: ACTIVATED,
        deactivatedNotification: DEACTIVATED,
      }),
    ),
  );

  return action;
}

const sent = (action: ReturnType<typeof actionWith>) => Object.fromEntries(action.mock.calls[0]?.[1] as FormData);

describe("UserStatusActions", () => {
  it("desactivar confirma con el boton destructivo y la consecuencia real", async () => {
    const action = await renderActions("activo");

    expect(buttonIn(host, "Desactivar").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Desactivar").click());

    expect(confirmation()?.textContent).toContain("¿Desactivar a Ana Quispe?");
    expect(confirmation()?.textContent).toContain(
      "No podrá iniciar sesión y su sesión abierta se cierra en su próxima acción, hasta que lo reactives.",
    );
    expect(buttonIn(confirmation()!, "Desactivar").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(confirmation()!, "Desactivar").click());
    await settle();

    expect(sent(action)).toEqual({ id_usuario: USUARIO, estado: "inactivo" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(DEACTIVATED);
  });

  it("activar se aplica al pulsar, sin confirmar", async () => {
    const action = await renderActions("inactivo", { action: actionWith(done("activo")) });

    await act(async () => buttonIn(host, "Activar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(sent(action)).toEqual({ id_usuario: USUARIO, estado: "activo" });
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
  });

  it("el administrador no puede desactivarse: el boton no hace nada", async () => {
    const action = await renderActions("activo", { isSelf: true });
    const button = buttonIn(host, "Desactivar");

    expect(button.getAttribute("aria-disabled")).toBe("true");

    await act(async () => button.click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "El usuario ya está inactivo.";
    await renderActions("activo", {
      action: actionWith({ status: "error", error: message, values: { id: USUARIO }, operationId: "op" }),
    });

    await act(async () => buttonIn(host, "Desactivar").click());
    await act(async () => buttonIn(confirmation()!, "Desactivar").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
