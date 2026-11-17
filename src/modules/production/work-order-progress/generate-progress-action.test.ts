// @vitest-environment jsdom
import { act, createElement as h, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { GenerateProgressAction } from "@/modules/production/work-order-progress/generate-progress-action";

// Generar los avances de una orden desde su pagina de avances (C3 de la 11.6c, D80), con el Radix
// real. Antes era un formulario que redirigia y lanzaba cualquier rechazo (la orden ya tiene
// avances, esta anulada) a la pagina de error. Ahora confirma con el boton normal: no anula nada,
// pero crea un avance por cada etapa activa de la ruta, y la confirmacion dice cuantos y de que
// ruta. Un rechazo queda dentro de la confirmacion. Sin ruta o sin etapas el boton no se puede usar.

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
const GENERATED = { type: "success" as const, message: "Avances generados" };
const LABEL = "Generar avances por etapa";

type Props = ComponentProps<typeof GenerateProgressAction>;

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

const generated: RowStatusState = { status: "success", data: { estado: "generado" }, values: { id: OT }, operationId: "op" };

async function render(action: ReturnType<typeof actionWith>, changes: Partial<Props> = {}) {
  await act(async () =>
    root.render(
      h(GenerateProgressAction, {
        idOrdenTrabajo: OT,
        routeName: "Ruta estándar para lampa",
        stageCount: 6,
        disabled: false,
        action,
        successNotification: GENERATED,
        ...changes,
      }),
    ),
  );
}

describe("GenerateProgressAction (C3 de la 11.6c)", () => {
  it("confirma con el boton normal, dice cuantas etapas y de que ruta, y genera", async () => {
    const action = actionWith(generated);
    await render(action);

    expect(buttonIn(host, LABEL).getAttribute("data-variant")).toBe("default");

    await act(async () => buttonIn(host, LABEL).click());

    expect(confirmation()?.textContent).toContain(`¿Generar los avances de la orden ${OT}?`);
    expect(confirmation()?.textContent).toContain(
      "Se crean 6 avances pendientes, uno por cada etapa activa de la ruta «Ruta estándar para lampa».",
    );
    expect(buttonIn(confirmation()!, "Generar").getAttribute("data-variant")).toBe("default");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Generar").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_orden_trabajo: OT });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(GENERATED);
  });

  it("con una sola etapa lo dice en singular", async () => {
    await render(actionWith(generated), { stageCount: 1 });

    await act(async () => buttonIn(host, LABEL).click());

    expect(confirmation()?.textContent).toContain(
      "Se crea 1 avance pendiente, para la única etapa activa de la ruta «Ruta estándar para lampa».",
    );
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso", async () => {
    const message = "Esta orden ya tiene avances generados.";
    await render(actionWith({ status: "error", error: message, values: { id: OT }, operationId: "op" }));

    await act(async () => buttonIn(host, LABEL).click());
    await act(async () => buttonIn(confirmation()!, "Generar").click());
    await settle();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("sin ruta o sin etapas el boton se ve deshabilitado y no abre la confirmacion", async () => {
    const action = actionWith(generated);
    await render(action, { routeName: null, stageCount: 0, disabled: true });

    const button = buttonIn(host, LABEL);

    expect(button.getAttribute("aria-disabled")).toBe("true");

    await act(async () => button.click());

    expect(confirmation()).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });
});
