// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { OperatorStatusActions } from "@/modules/staff/operators/operator-status-actions";

// Activar e inactivar un operario desde su fila (A7 de la 10.8a), con el Radix real.
// Activar se aplica al pulsar; inactivar confirma con el boton destructivo y dice la
// consecuencia real: un operario inactivo no aparece al registrar asistencia,
// tareas, planillas ni al reasignar avances, y sus registros se conservan.

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

const OPERARIO = "OPE00000003";
const ACTIVATED = { type: "success" as const, message: "Activado" };
const DEACTIVATED = { type: "warning" as const, message: "Desactivado" };
const CONSEQUENCE =
  "No aparecerá al registrar asistencia, tareas ni planillas, ni al reasignar avances, hasta que lo reactives. Sus registros anteriores se conservan.";

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
  values: { id: OPERARIO },
  operationId: "op",
});

function actionWith(state: RowStatusState) {
  return vi.fn<(prev: RowStatusState, formData: FormData) => Promise<RowStatusState>>(async () => state);
}

async function renderActions(estado: string, action = actionWith(done("inactivo"))) {
  await act(async () =>
    root.render(
      h(OperatorStatusActions, {
        operator: { id_operario: OPERARIO, nombre: "Luis Huaman", estado },
        action,
        activatedNotification: ACTIVATED,
        deactivatedNotification: DEACTIVATED,
      }),
    ),
  );

  return action;
}

const sent = (action: ReturnType<typeof actionWith>) => Object.fromEntries(action.mock.calls[0]?.[1] as FormData);

describe("OperatorStatusActions", () => {
  it("inactivar confirma con el boton destructivo y la consecuencia real", async () => {
    const action = await renderActions("activo");

    expect(buttonIn(host, "Inactivar").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Inactivar").click());

    expect(confirmation()?.textContent).toContain("¿Inactivar a Luis Huaman?");
    expect(confirmation()?.textContent).toContain(CONSEQUENCE);
    expect(buttonIn(confirmation()!, "Inactivar").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(sent(action)).toEqual({ id_operario: OPERARIO, estado: "inactivo" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(DEACTIVATED);
  });

  it("activar se aplica al pulsar, sin confirmar", async () => {
    const action = await renderActions("inactivo", actionWith(done("activo")));

    await act(async () => buttonIn(host, "Activar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(sent(action)).toEqual({ id_operario: OPERARIO, estado: "activo" });
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "El operario ya está inactivo.";
    await renderActions(
      "activo",
      actionWith({ status: "error", error: message, values: { id: OPERARIO }, operationId: "op" }),
    );

    await act(async () => buttonIn(host, "Inactivar").click());
    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
