// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { CampaignStatusActions } from "@/modules/production/campaigns/campaign-status-actions";

// Activar, finalizar y anular desde la fila (entrega 10.7a), con el Radix real. Activar
// se ejecuta al pulsar; finalizar confirma con el boton normal y anular con el
// destructivo, cada uno con su consecuencia. Un error queda dentro de la confirmacion.

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

const CAMPANIA = "CAM00000003";
const ACTIVATED = { type: "success" as const, message: "Activada" };
const FINISHED = { type: "success" as const, message: "Finalizada" };
const ANNULLED = { type: "warning" as const, message: "Anulada" };

const confirmation = () => document.querySelector('[role="alertdialog"]');
const labels = () => [...host.querySelectorAll("button")].map((item) => item.textContent?.trim());

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
  values: { id: CAMPANIA },
  operationId: "op",
});

function actionWith(state: RowStatusState) {
  return vi.fn<(prev: RowStatusState, formData: FormData) => Promise<RowStatusState>>(async () => state);
}

async function renderActions(estado: string, action = actionWith(done("activa"))) {
  await act(async () =>
    root.render(
      h(CampaignStatusActions, {
        campaign: { id_campania: CAMPANIA, nombre_campania: "Campaña escolar", estado },
        action,
        activatedNotification: ACTIVATED,
        finishedNotification: FINISHED,
        annulledNotification: ANNULLED,
      }),
    ),
  );

  return action;
}

const sent = (action: ReturnType<typeof actionWith>) => Object.fromEntries(action.mock.calls[0]?.[1] as FormData);

describe("CampaignStatusActions", () => {
  it.each([
    ["planificada", ["Activar", "Anular"]],
    ["activa", ["Finalizar", "Anular"]],
    ["finalizada", []],
    ["anulada", []],
  ])("una campaña %s ofrece sus acciones", async (estado, esperado) => {
    await renderActions(estado);

    expect(labels()).toEqual(esperado);
  });

  it("activar se ejecuta al pulsar, sin confirmar", async () => {
    const action = await renderActions("planificada");

    await act(async () => buttonIn(host, "Activar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(sent(action)).toEqual({ id_campania: CAMPANIA, estado: "activa" });
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
  });

  it("finalizar confirma con el boton normal y dice que solo queda anular", async () => {
    const action = await renderActions("activa", actionWith(done("finalizada")));

    await act(async () => buttonIn(host, "Finalizar").click());

    expect(confirmation()?.textContent).toContain("¿Finalizar la campaña Campaña escolar?");
    expect(confirmation()?.textContent).toContain("No se podrán agregar productos ni crear órdenes de trabajo para ella.");
    expect(confirmation()?.textContent).toContain("Después solo se podrá anular.");
    expect(buttonIn(confirmation()!, "Finalizar").getAttribute("data-variant")).toBe("default");

    await act(async () => buttonIn(confirmation()!, "Finalizar").click());
    await settle();

    expect(sent(action)).toEqual({ id_campania: CAMPANIA, estado: "finalizada" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(FINISHED);
  });

  it("anular confirma con el boton destructivo y conserva las ordenes", async () => {
    const action = await renderActions("activa", actionWith(done("anulada")));

    await act(async () => buttonIn(host, "Anular").click());

    expect(confirmation()?.textContent).toContain("¿Anular la campaña Campaña escolar?");
    expect(confirmation()?.textContent).toContain("Las órdenes ya creadas se conservan.");
    expect(confirmation()?.textContent).toContain("No se puede deshacer.");
    expect(buttonIn(confirmation()!, "Anular").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(sent(action)).toEqual({ id_campania: CAMPANIA, estado: "anulada" });
    expect(notifications.notify).toHaveBeenCalledWith(ANNULLED);
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "La campaña ya estaba en ese estado.";
    await renderActions(
      "activa",
      actionWith({ status: "error", error: message, values: { id: CAMPANIA }, operationId: "op" }),
    );

    await act(async () => buttonIn(host, "Finalizar").click());
    await act(async () => buttonIn(confirmation()!, "Finalizar").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
