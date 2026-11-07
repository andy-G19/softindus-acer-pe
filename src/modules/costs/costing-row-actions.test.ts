// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { CostingRecalculateAction } from "@/modules/costs/costings/costing-recalculate-action";
import { IndirectCostAnnulAction } from "@/modules/costs/indirect-costs/indirect-cost-annul-action";

// Recalcular el costeo y anular un costo indirecto desde el detalle (B5 de la 10.8b, D6),
// con el Radix real. Recalcular no anula nada: confirma con el boton normal y dice lo que
// hace. Anular confirma con el boton destructivo y la consecuencia real sobre los totales.

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

const COSTEO = "COS00000004";
const INDIRECTO = "CIN00000002";
const RECALCULATED = { type: "success" as const, message: "Costeo recalculado correctamente" };
const ANNULLED = { type: "warning" as const, message: "Costo indirecto anulado" };

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

describe("CostingRecalculateAction", () => {
  async function render(action: ReturnType<typeof actionWith>) {
    await act(async () =>
      root.render(h(CostingRecalculateAction, { idCosteo: COSTEO, action, successNotification: RECALCULATED })),
    );
  }

  it("confirma con el boton normal y dice lo que conserva y lo que suma", async () => {
    const action = actionWith({ status: "success", data: { estado: "recalculado" }, values: { id: COSTEO }, operationId: "op" });
    await render(action);

    await act(async () => buttonIn(host, "Recalcular costeo").click());

    expect(confirmation()?.textContent).toContain(`¿Recalcular el costeo ${COSTEO}?`);
    expect(confirmation()?.textContent).toContain(
      "Conserva los materiales, los consumibles y la mano de obra guardados, y suma los costos indirectos vigentes. Se actualizan el costo total y el unitario.",
    );
    expect(buttonIn(confirmation()!, "Recalcular").getAttribute("data-variant")).toBe("default");

    await act(async () => buttonIn(confirmation()!, "Recalcular").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_costeo: COSTEO });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(RECALCULATED);
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "El costeo seleccionado no existe.";
    await render(actionWith({ status: "error", error: message, values: { id: COSTEO }, operationId: "op" }));

    await act(async () => buttonIn(host, "Recalcular costeo").click());
    await act(async () => buttonIn(confirmation()!, "Recalcular").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

describe("IndirectCostAnnulAction", () => {
  async function render(action: ReturnType<typeof actionWith>) {
    await act(async () =>
      root.render(
        h(IndirectCostAnnulAction, {
          indirectCost: { id_costo_indirecto: INDIRECTO, concepto: "Consumo de luz del lote" },
          action,
          successNotification: ANNULLED,
        }),
      ),
    );
  }

  it("anular confirma con el boton destructivo y la consecuencia sobre los totales", async () => {
    const action = actionWith({ status: "success", data: { estado: "anulado" }, values: { id: INDIRECTO }, operationId: "op" });
    await render(action);

    expect(buttonIn(host, "Anular").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Anular").click());

    expect(confirmation()?.textContent).toContain("¿Anular el costo indirecto «Consumo de luz del lote»?");
    expect(confirmation()?.textContent).toContain(
      "Su monto pasa a S/ 0.00 y deja de sumar al costeo; se recalculan el costo total y el unitario. El monto original queda en sus observaciones.",
    );

    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_costo_indirecto: INDIRECTO });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ANNULLED);
  });

  it("si ya estaba anulado, el mensaje queda dentro de la confirmacion, sin aviso", async () => {
    const message = "El costo indirecto ya se encuentra anulado.";
    await render(actionWith({ status: "error", error: message, values: { id: INDIRECTO }, operationId: "op" }));

    await act(async () => buttonIn(host, "Anular").click());
    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
