// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { PurchaseAnnulAction } from "@/modules/inventory/purchases/purchase-annul-action";

// Anular una compra desde su fila del listado o desde su detalle (C5 de la 11.2a), con el
// Radix real. Confirma con el boton destructivo y la consecuencia de annulPurchaseAction:
// revierte del stock lo que ingreso, con su salida en el kardex. Un rechazo (tiene pagos, no
// hay stock para revertir, ya estaba anulada) queda dentro de la confirmacion: antes la
// accion redirigia sin decir por que.

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

const COMPRA = "COM00000003";
const ANNULLED = { type: "warning" as const, message: "Compra anulada" };

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

async function render(action: ReturnType<typeof actionWith>, label?: string) {
  await act(async () =>
    root.render(h(PurchaseAnnulAction, { idCompra: COMPRA, action, successNotification: ANNULLED, label })),
  );
}

describe("PurchaseAnnulAction", () => {
  it("confirma con el boton destructivo y la consecuencia sobre el stock", async () => {
    const action = actionWith({ status: "success", data: { estado: "anulada" }, values: { id: COMPRA }, operationId: "op" });
    await render(action);

    expect(buttonIn(host, "Anular").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Anular").click());

    expect(confirmation()?.textContent).toContain(`¿Anular la compra ${COMPRA}?`);
    expect(confirmation()?.textContent).toContain(
      "Se revierte del stock lo que ingresó con esta compra, con su salida en el kardex, y la compra queda anulada. No se puede deshacer.",
    );

    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_compra: COMPRA });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ANNULLED);
  });

  it("en el detalle el boton dice «Anular compra»", async () => {
    await render(actionWith({ status: "idle" }), "Anular compra");

    expect(buttonIn(host, "Anular compra").getAttribute("data-variant")).toBe("destructive");
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "No se puede anular una compra con pagos registrados.";
    await render(actionWith({ status: "error", error: message, values: { id: COMPRA }, operationId: "op" }));

    await act(async () => buttonIn(host, "Anular").click());
    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
