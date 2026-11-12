// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { QuoteAnnulAction } from "@/modules/commercial/quotes/quote-annul-action";

// Anular una proforma desde su fila del listado o desde su detalle (C6 de la 11.3a), con el Radix
// real. Confirma con el boton destructivo y la consecuencia de annulQuoteAction: la proforma queda
// anulada y su pedido vuelve a admitir una proforma nueva. Un rechazo (tiene pagos, tiene un
// comprobante emitido, ya estaba anulada) queda dentro de la confirmacion: antes la accion
// redirigia sin decir por que.

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

const PROFORMA = "PRF00000007";
// C9 de la 11.3b (hallazgo 9 de la 11.3a): la confirmacion nombra la proforma por el numero que
// muestran el listado y el detalle (PF-...), no por su id interno (PRF...).
const NUMERO = "PF-00000007";
const ANNULLED = { type: "warning" as const, message: "Proforma anulada" };

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
  await act(async () => root.render(
      h(QuoteAnnulAction, { quote: { id_proforma: PROFORMA, numero_proforma: NUMERO }, action, successNotification: ANNULLED }),
    ));
}

describe("QuoteAnnulAction", () => {
  it("confirma con el boton destructivo y la consecuencia sobre el pedido", async () => {
    const action = actionWith({ status: "success", data: { estado: "anulada" }, values: { id: PROFORMA }, operationId: "op" });
    await render(action);

    expect(buttonIn(host, "Anular").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Anular").click());

    expect(confirmation()?.textContent).toContain(`¿Anular la proforma ${NUMERO}?`);
    expect(confirmation()?.textContent).toContain(
      "La proforma queda anulada y su pedido vuelve a admitir una proforma nueva. No se puede deshacer.",
    );

    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_proforma: PROFORMA });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ANNULLED);
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "No se puede anular una proforma con pagos registrados.";
    await render(actionWith({ status: "error", error: message, values: { id: PROFORMA }, operationId: "op" }));

    await act(async () => buttonIn(host, "Anular").click());
    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
