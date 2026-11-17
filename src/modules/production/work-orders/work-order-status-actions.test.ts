// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import {
  WorkOrderAnnulAction,
  WorkOrderFinishAction,
} from "@/modules/production/work-orders/work-order-status-actions";

// Anular y finalizar una orden desde su fila del listado (C4 de la 11.6b, D76), con el Radix real.
// Anular usaba el ultimo ConfirmDeleteButton (SweetAlert2) y finalizar no confirmaba; los dos
// redirigian y lanzaban cualquier rechazo (una orden con movimientos de material, una con etapas
// sin terminar) a la pagina de error. Ahora confirman con ConfirmActionButton: anular con el boton
// destructivo, nombrando la orden, su producto y la consecuencia; finalizar con el normal, porque no
// anula nada. Un rechazo queda dentro de la confirmacion.

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

const OT = "OTR00000007";
const ORDER = { id_orden_trabajo: OT, producto: { nombre_producto: "Puerta metálica" } };
const ANNULLED = { type: "warning" as const, message: "Orden de trabajo anulada" };
const FINISHED = { type: "success" as const, message: "Orden de trabajo finalizada" };

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

const done = (estado: string): RowStatusState => ({
  status: "success",
  data: { estado },
  values: { id: OT },
  operationId: "op",
});

const rejected = (error: string): RowStatusState => ({ status: "error", error, values: { id: OT }, operationId: "op" });

describe("WorkOrderAnnulAction (C4 de la 11.6b)", () => {
  async function render(action: ReturnType<typeof actionWith>) {
    await act(async () => root.render(h(WorkOrderAnnulAction, { order: ORDER, action, successNotification: ANNULLED })));
  }

  it("confirma con el boton destructivo, nombra la orden, su producto y la consecuencia", async () => {
    const action = actionWith(done("anulada"));
    await render(action);

    expect(buttonIn(host, "Anular").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Anular").click());

    expect(confirmation()?.textContent).toContain(`¿Anular la orden ${OT}?`);
    expect(confirmation()?.textContent).toContain(
      "La orden de Puerta metálica queda anulada: ya no recibe material ni se puede finalizar. No se puede deshacer.",
    );
    expect(buttonIn(confirmation()!, "Anular").getAttribute("data-variant")).toBe("destructive");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_orden_trabajo: OT });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ANNULLED);
  });

  it("una orden con movimientos de material: el rechazo queda en la confirmacion, sin aviso", async () => {
    const message = "No se puede anular una orden con consumos registrados sin reversar inventario.";
    await render(actionWith(rejected(message)));

    await act(async () => buttonIn(host, "Anular").click());
    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

describe("WorkOrderFinishAction (C4 de la 11.6b)", () => {
  async function render(action: ReturnType<typeof actionWith>) {
    await act(async () => root.render(h(WorkOrderFinishAction, { order: ORDER, action, successNotification: FINISHED })));
  }

  it("confirma con el boton normal y dice que la orden ya no recibe material", async () => {
    const action = actionWith(done("finalizada"));
    await render(action);

    expect(buttonIn(host, "Finalizar").getAttribute("data-variant")).not.toBe("destructive");

    await act(async () => buttonIn(host, "Finalizar").click());

    expect(confirmation()?.textContent).toContain(`¿Finalizar la orden ${OT}?`);
    expect(confirmation()?.textContent).toContain(
      "La orden de Puerta metálica queda finalizada con la fecha de hoy y ya no recibe material.",
    );
    expect(buttonIn(confirmation()!, "Finalizar").getAttribute("data-variant")).toBe("default");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Finalizar").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_orden_trabajo: OT });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(FINISHED);
  });

  it("etapas sin terminar: el rechazo queda en la confirmacion, sin aviso", async () => {
    const message = "Solo se puede finalizar una orden cuando todas sus etapas estan terminadas.";
    await render(actionWith(rejected(message)));

    await act(async () => buttonIn(host, "Finalizar").click());
    await act(async () => buttonIn(confirmation()!, "Finalizar").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
