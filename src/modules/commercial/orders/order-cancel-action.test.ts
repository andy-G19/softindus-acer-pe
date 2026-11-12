// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { OrderCancelAction } from "@/modules/commercial/orders/order-cancel-action";

// Cancelar un pedido desde su fila (C8 de la 11.3b), con el Radix real. Confirma con el boton
// destructivo y la consecuencia de cancelOrderAction; el boton que cierra dice «Volver», para no
// tener dos botones que digan «Cancelar». Un rechazo queda dentro de la confirmacion: antes la
// accion volvia al listado sin decir por que.

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

const PEDIDO = "PED00000004";
const CANCELLED = { type: "warning" as const, message: "Pedido cancelado" };

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

async function render(action: ReturnType<typeof actionWith>) {
  await act(async () => root.render(h(OrderCancelAction, { idPedido: PEDIDO, action, successNotification: CANCELLED })));
}

describe("OrderCancelAction", () => {
  it("confirma con el boton destructivo, la consecuencia y «Volver» para cerrar", async () => {
    const action = actionWith({ status: "success", data: { estado: "cancelado" }, values: { id: PEDIDO }, operationId: "op" });
    await render(action);

    expect(buttonIn(host, "Cancelar").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Cancelar").click());

    const dialog = confirmation()!;

    expect(dialog.textContent).toContain(`¿Cancelar el pedido ${PEDIDO}?`);
    expect(dialog.textContent).toContain(
      "El pedido queda cancelado: ya no se puede editar ni generar su proforma. No se puede deshacer.",
    );
    expect([...dialog.querySelectorAll("button")].map((button) => button.textContent?.trim())).toEqual([
      "Volver",
      "Cancelar pedido",
    ]);

    await act(async () => buttonIn(dialog, "Cancelar pedido").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_pedido: PEDIDO });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(CANCELLED);
  });

  it("«Volver» cierra sin cancelar", async () => {
    const action = actionWith({ status: "idle" });
    await render(action);

    await act(async () => buttonIn(host, "Cancelar").click());
    await act(async () => buttonIn(confirmation()!, "Volver").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "No se puede modificar un pedido con proforma, comprobante u orden asociada.";
    await render(actionWith({ status: "error", error: message, values: { id: PEDIDO }, operationId: "op" }));

    await act(async () => buttonIn(host, "Cancelar").click());
    await act(async () => buttonIn(confirmation()!, "Cancelar pedido").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
