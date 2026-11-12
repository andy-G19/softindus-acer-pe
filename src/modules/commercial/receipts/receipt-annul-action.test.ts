// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { ReceiptAnnulAction } from "@/modules/commercial/receipts/receipt-annul-action";

// Anular un comprobante desde su fila (C7 de la 11.3b), con el Radix real. Confirma con el boton
// destructivo, el numero que muestra el listado y la consecuencia de annulReceiptAction. Un
// rechazo (no existe, ya estaba anulado) queda dentro de la confirmacion: antes la accion volvia
// al listado sin decir nada.

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

const COMPROBANTE = "CMP00000003";
const NUMERO = "B001-000123";
const ANNULLED = { type: "warning" as const, message: "Comprobante anulado" };

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
  await act(async () =>
    root.render(
      h(ReceiptAnnulAction, { idComprobante: COMPROBANTE, numeroComprobante: NUMERO, action, successNotification: ANNULLED }),
    ),
  );
}

describe("ReceiptAnnulAction", () => {
  it("confirma con el boton destructivo, el numero del comprobante y su consecuencia", async () => {
    const action = actionWith({ status: "success", data: { estado: "anulado" }, values: { id: COMPROBANTE }, operationId: "op" });
    await render(action);

    expect(buttonIn(host, "Anular").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Anular").click());

    expect(confirmation()?.textContent).toContain(`¿Anular el comprobante ${NUMERO}?`);
    expect(confirmation()?.textContent).toContain(
      "El comprobante queda anulado y su proforma vuelve a admitir un comprobante nuevo. No se puede deshacer.",
    );

    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_comprobante: COMPROBANTE });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ANNULLED);
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "El comprobante no existe o ya estaba anulado.";
    await render(actionWith({ status: "error", error: message, values: { id: COMPROBANTE }, operationId: "op" }));

    await act(async () => buttonIn(host, "Anular").click());
    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
