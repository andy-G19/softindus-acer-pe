// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { TaskCancelAction } from "@/modules/staff/tasks/task-cancel-action";

// Anular una tarea desde su fila (A9 de la 10.8a), con el Radix real. Confirma con
// el boton destructivo y la consecuencia real: la tarea deja de contar en la mano
// de obra de los costeos que se generen despues, y los ya generados no cambian.

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

const TAREA = "TAR00000007";
const ANNULLED = { type: "warning" as const, message: "Tarea anulada" };
const CONSEQUENCE =
  "Dejará de contar en la mano de obra de los costeos que se generen después. Los costeos ya generados no cambian.";

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

function actionWith(state: RowStatusState) {
  return vi.fn<(prev: RowStatusState, formData: FormData) => Promise<RowStatusState>>(async () => state);
}

async function renderAction(action: ReturnType<typeof actionWith>) {
  await act(async () =>
    root.render(
      h(TaskCancelAction, {
        task: { id_tarea_operario: TAREA, descripcion: "Corte de piezas" },
        action,
        successNotification: ANNULLED,
      }),
    ),
  );
}

describe("TaskCancelAction", () => {
  it("anular confirma con el boton destructivo y la consecuencia real", async () => {
    const action = actionWith({ status: "success", data: { estado: "anulada" }, values: { id: TAREA }, operationId: "op" });
    await renderAction(action);

    expect(buttonIn(host, "Anular").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Anular").click());

    expect(confirmation()?.textContent).toContain("¿Anular la tarea TAR00000007?");
    expect(confirmation()?.textContent).toContain(CONSEQUENCE);

    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_tarea_operario: TAREA });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ANNULLED);
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "La tarea ya se encuentra anulada.";
    await renderAction(actionWith({ status: "error", error: message, values: { id: TAREA }, operationId: "op" }));

    await act(async () => buttonIn(host, "Anular").click());
    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
