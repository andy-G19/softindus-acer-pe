// @vitest-environment jsdom
import { act, createElement as h, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { DeliverPendingAction } from "@/modules/production/work-orders/deliver-pending-action";

// Entregar lo pendiente desde la cabecera del detalle (C3 de la 11.6b, D75), con el Radix real.
// Antes era un formulario que redirigia al detalle y lanzaba cualquier rechazo (stock
// insuficiente, material inactivo, nada pendiente) a la pagina de error. Ahora confirma con el
// boton normal, no el destructivo: no anula nada, pero saca material del almacen, y la
// confirmacion dice cuantos materiales salen y cuanto de cada uno. Un rechazo queda dentro de la
// confirmacion. Sin clave: lo pendiente ya hace que un segundo envio no entregue nada.

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
const DELIVERED = { type: "success" as const, message: "Materiales entregados a la orden" };
const PLANCHA = { materialName: "Plancha LAC 2 mm", quantity: "48.75", unidad: "kg" };
const SOLDADURA = { materialName: "Soldadura", quantity: "8.57", unidad: "kg" };

type Props = ComponentProps<typeof DeliverPendingAction>;

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

const delivered: RowStatusState = { status: "success", data: { estado: "entregado" }, values: { id: OT }, operationId: "op" };

async function render(action: ReturnType<typeof actionWith>, changes: Partial<Props> = {}) {
  await act(async () =>
    root.render(
      h(DeliverPendingAction, {
        idOrdenTrabajo: OT,
        hasDeliveries: false,
        lines: [PLANCHA, SOLDADURA],
        action,
        successNotification: DELIVERED,
        ...changes,
      }),
    ),
  );
}

describe("DeliverPendingAction (C3 de la 11.6b)", () => {
  it("confirma con el boton normal, dice que sale del almacen y entrega la orden", async () => {
    const action = actionWith(delivered);
    await render(action);

    expect(buttonIn(host, "Entregar materiales").getAttribute("data-variant")).toBe("default");

    await act(async () => buttonIn(host, "Entregar materiales").click());

    expect(confirmation()?.textContent).toContain(`¿Entregar los materiales de la orden ${OT}?`);
    expect(confirmation()?.textContent).toContain(
      "Salen del almacén 2 materiales: Plancha LAC 2 mm 48.75 kg, Soldadura 8.57 kg. Se descuentan del stock y quedan en el kardex.",
    );
    expect(buttonIn(confirmation()!, "Entregar").getAttribute("data-variant")).toBe("default");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Entregar").click());
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_orden_trabajo: OT });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(DELIVERED);
  });

  it("con entregas previas ofrece entregar lo pendiente y nombra un solo material en singular", async () => {
    await render(actionWith(delivered), { hasDeliveries: true, lines: [PLANCHA] });

    await act(async () => buttonIn(host, "Entregar lo pendiente").click());

    expect(confirmation()?.textContent).toContain(
      "Sale del almacén 1 material: Plancha LAC 2 mm 48.75 kg. Se descuenta del stock y queda en el kardex.",
    );
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "Stock insuficiente para entregar la orden: Plancha LAC 2 mm requiere 48.75 y tiene 30.00.";
    await render(actionWith({ status: "error", error: message, values: { id: OT }, operationId: "op" }));

    await act(async () => buttonIn(host, "Entregar materiales").click());
    await act(async () => buttonIn(confirmation()!, "Entregar").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
