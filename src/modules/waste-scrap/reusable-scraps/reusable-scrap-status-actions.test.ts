// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { ReusableScrapStatusActions } from "@/modules/waste-scrap/reusable-scraps/reusable-scrap-status-actions";

// Reutilizar y descartar desde la fila (entrega 10.7a), con el Radix real. Ninguna se
// deshace: reutilizar confirma con el boton normal y descartar con el destructivo. Un
// error queda dentro de la confirmacion.

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

const RETAZO = "RET00000003";
const REUSED = { type: "success" as const, message: "Reutilizado" };
const DISCARDED = { type: "warning" as const, message: "Descartado" };

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
  values: { id: RETAZO },
  operationId: "op",
});

function actionWith(state: RowStatusState) {
  return vi.fn<(prev: RowStatusState, formData: FormData) => Promise<RowStatusState>>(async () => state);
}

async function renderActions(estado: string, action = actionWith(done("reutilizado"))) {
  await act(async () =>
    root.render(
      h(ReusableScrapStatusActions, {
        scrap: { id_retazo: RETAZO, estado },
        action,
        reusedNotification: REUSED,
        discardedNotification: DISCARDED,
      }),
    ),
  );

  return action;
}

const sent = (action: ReturnType<typeof actionWith>) => Object.fromEntries(action.mock.calls[0]?.[1] as FormData);

describe("ReusableScrapStatusActions", () => {
  it.each(["reutilizado", "descartado"])("un retazo %s no ofrece acciones", async (estado) => {
    await renderActions(estado);

    expect(host.querySelectorAll("button")).toHaveLength(0);
    expect(host.textContent).toContain("Sin acción");
  });

  it("reutilizar confirma con el boton normal y dice que no cambia mas", async () => {
    const action = await renderActions("disponible");

    await act(async () => buttonIn(host, "Reutilizar").click());

    expect(confirmation()?.textContent).toContain(`¿Marcar el retazo ${RETAZO} como reutilizado?`);
    expect(confirmation()?.textContent).toContain("Dejará de estar disponible y no se podrá cambiar su estado.");
    expect(buttonIn(confirmation()!, "Reutilizar").getAttribute("data-variant")).toBe("default");

    await act(async () => buttonIn(confirmation()!, "Reutilizar").click());
    await settle();

    expect(sent(action)).toEqual({ id_retazo: RETAZO, estado: "reutilizado" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(REUSED);
  });

  it("descartar confirma con el boton destructivo", async () => {
    const action = await renderActions("disponible", actionWith(done("descartado")));

    await act(async () => buttonIn(host, "Descartar").click());

    expect(confirmation()?.textContent).toContain(`¿Descartar el retazo ${RETAZO}?`);
    expect(confirmation()?.textContent).toContain("No se puede deshacer.");
    expect(buttonIn(confirmation()!, "Descartar").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(confirmation()!, "Descartar").click());
    await settle();

    expect(sent(action)).toEqual({ id_retazo: RETAZO, estado: "descartado" });
    expect(notifications.notify).toHaveBeenCalledWith(DISCARDED);
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "Solo se puede cambiar el estado de retazos disponibles.";
    await renderActions(
      "disponible",
      actionWith({ status: "error", error: message, values: { id: RETAZO }, operationId: "op" }),
    );

    await act(async () => buttonIn(host, "Reutilizar").click());
    await act(async () => buttonIn(confirmation()!, "Reutilizar").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
