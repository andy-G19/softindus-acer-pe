// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { PayrollAnnulAction } from "@/modules/staff/payrolls/payroll-annul-action";

// Anular una planilla desde su fila del listado (C8 de la 11.5), con el Radix real. Confirma con
// el boton destructivo, nombrando la planilla, su operario y su periodo, y con la consecuencia
// real: ya no se puede pagar y el mismo periodo exacto no se puede volver a generar. Un rechazo
// (pagada, con un pago, ya anulada) queda dentro de la confirmacion: antes la accion lanzaba y se
// veia la pagina de error.

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

const PLANILLA = "PLA00000009";
const ANNULLED = { type: "warning" as const, message: "Planilla anulada" };

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
      h(PayrollAnnulAction, {
        payroll: {
          id_planilla: PLANILLA,
          periodo_inicio: new Date("2026-11-02T00:00:00.000Z"),
          periodo_fin: new Date("2026-11-08T00:00:00.000Z"),
          operario: { nombres: "Luis", apellidos: "Quispe" },
        },
        action,
        successNotification: ANNULLED,
      }),
    ),
  );
}

describe("PayrollAnnulAction", () => {
  it("confirma con el boton destructivo, el operario, el periodo y la consecuencia", async () => {
    const action = actionWith({ status: "success", data: { estado: "anulada" }, values: { id: PLANILLA }, operationId: "op" });
    await render(action);

    expect(buttonIn(host, "Anular").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Anular").click());

    expect(confirmation()?.textContent).toContain(`¿Anular la planilla ${PLANILLA}?`);
    expect(confirmation()?.textContent).toContain(
      "La planilla de Quispe, Luis del 02/11/2026 al 08/11/2026 queda anulada y ya no se puede pagar. Sus días pueden entrar en otra planilla, pero no con este mismo periodo. No se puede deshacer.",
    );

    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_planilla: PLANILLA });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ANNULLED);
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "No se puede anular una planilla que ya fue pagada.";
    await render(actionWith({ status: "error", error: message, values: { id: PLANILLA }, operationId: "op" }));

    await act(async () => buttonIn(host, "Anular").click());
    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
