// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { MovementAnnulAction } from "@/modules/petty-cash/movements/movement-annul-action";

// Anular un movimiento de caja chica desde su fila (C8 de la 11.4a, D47), con el Radix real.
// Confirma con el boton destructivo, nombra el movimiento por su concepto y su monto, y dice hacia
// donde va el dinero: un egreso o un ajuste negativo vuelven a la caja; un ingreso o un ajuste
// positivo salen de ella. Un rechazo queda dentro de la confirmacion: antes la accion lanzaba a la
// pagina de error.

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

const MOVIMIENTO = "MCA00000009";
const ANNULLED = { type: "warning" as const, message: "Movimiento de caja anulado" };

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

async function render(
  action: ReturnType<typeof actionWith>,
  movement: { concepto: string; tipo_movimiento: string } = { concepto: "Taxi a proveedor", tipo_movimiento: "egreso" },
) {
  await act(async () => root.render(
      h(MovementAnnulAction, {
        movement: { id_movimiento_caja: MOVIMIENTO, monto: "40.25", ...movement },
        action,
        successNotification: ANNULLED,
      }),
    ));
}

describe("MovementAnnulAction", () => {
  it("confirma con el boton destructivo, el concepto, el monto y que el dinero vuelve a la caja", async () => {
    const action = actionWith({ status: "success", data: { estado: "anulado" }, values: { id: MOVIMIENTO }, operationId: "op" });
    await render(action);

    expect(buttonIn(host, "Anular").getAttribute("data-variant")).toBe("destructive");

    await act(async () => buttonIn(host, "Anular").click());

    expect(confirmation()?.textContent).toContain("¿Anular «Taxi a proveedor» por S/ 40.25?");
    expect(confirmation()?.textContent).toContain(
      "El movimiento queda anulado y su monto vuelve a la caja. No se puede deshacer.",
    );

    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_movimiento_caja: MOVIMIENTO });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ANNULLED);
  });

  it.each([
    ["un ingreso", { concepto: "Reposicion", tipo_movimiento: "ingreso" }, "se descuenta de la caja"],
    ["un ajuste positivo", { concepto: "Ajuste positivo: Sobrante", tipo_movimiento: "ajuste" }, "se descuenta de la caja"],
    ["un ajuste negativo", { concepto: "Ajuste negativo: Faltante", tipo_movimiento: "ajuste" }, "vuelve a la caja"],
  ])("%s dice hacia donde va su monto", async (_name, movement, direction) => {
    const ok = { status: "success" as const, data: { estado: "anulado" }, values: { id: MOVIMIENTO }, operationId: "op" };
    await render(actionWith(ok), movement);

    await act(async () => buttonIn(host, "Anular").click());

    expect(confirmation()?.textContent).toContain(
      `El movimiento queda anulado y su monto ${direction}. No se puede deshacer.`,
    );
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "Este ingreso es de la venta de chatarra VCH00000003; no se anula desde caja chica.";
    await render(actionWith({ status: "error", error: message, values: { id: MOVIMIENTO }, operationId: "op" }));

    await act(async () => buttonIn(host, "Anular").click());
    await act(async () => buttonIn(confirmation()!, "Anular").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
