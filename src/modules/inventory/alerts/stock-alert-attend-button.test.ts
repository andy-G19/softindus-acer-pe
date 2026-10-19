// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StockAlertAttendState } from "@/modules/inventory/alerts/actions";
import { StockAlertAttendButton } from "@/modules/inventory/alerts/stock-alert-attend-button";

// Atender una alerta de stock desde su fila (entrega 10.3, decision D4), con
// el Radix real: el snapshot de la pagina no distingue un boton con
// confirmacion de uno sin ella. Confirma con el material y la consecuencia,
// con el boton normal (no el destructivo); un error queda en la confirmacion.

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

const confirmation = () => document.querySelector('[role="alertdialog"]');

const ATTENDED = { type: "success" as const, message: "Alerta de stock atendida" };

type Respond = (formData: FormData) => StockAlertAttendState;

const succeed: Respond = (formData) => ({
  status: "success",
  data: { id_alerta: String(formData.get("id_alerta")) },
  values: { id: String(formData.get("id_alerta")) },
  operationId: crypto.randomUUID(),
});

async function renderButton(respond: Respond = succeed) {
  const action = vi.fn(async (_prev: StockAlertAttendState, formData: FormData) => respond(formData));

  await act(async () =>
    root.render(
      h(StockAlertAttendButton, {
        alert: { id_alerta: "ALE00000003", materialName: "Plancha LAC 1/16" },
        action,
        attendedNotification: ATTENDED,
      }),
    ),
  );

  return action;
}

function buttonIn(scope: ParentNode, text: string) {
  return [...scope.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;
}

describe("StockAlertAttendButton", () => {
  it("confirma con el material y la consecuencia, con el boton normal, y envia la alerta", async () => {
    const action = await renderButton();

    await act(async () => buttonIn(document, "Marcar atendida").click());

    expect(confirmation()?.textContent).toContain("¿Marcar atendida la alerta de Plancha LAC 1/16?");
    expect(confirmation()?.textContent).toContain("no se puede reactivar");
    expect(confirmation()?.textContent).toContain("seguirá en Stock crítico actual");
    expect(buttonIn(confirmation()!, "Marcar atendida").getAttribute("data-variant")).toBe("default");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Marcar atendida").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_alerta: "ALE00000003" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ATTENDED);
    expect(confirmation()).toBeNull();
  });

  it("si otro ya la atendio, el mensaje queda en la confirmacion sin aviso", async () => {
    await renderButton((formData) => ({
      status: "error",
      error: "La alerta ya estaba atendida.",
      values: { id: String(formData.get("id_alerta")) },
      operationId: crypto.randomUUID(),
    }));

    await act(async () => buttonIn(document, "Marcar atendida").click());
    await act(async () => buttonIn(confirmation()!, "Marcar atendida").click());
    await settle();

    expect(confirmation()?.textContent).toContain("La alerta ya estaba atendida.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
