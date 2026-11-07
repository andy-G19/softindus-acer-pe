// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CostingFromWorkOrderState } from "@/modules/costs/costings/actions";
import { GenerateCostingAction } from "@/modules/costs/costings/generate-costing-action";
import { costsNotifications } from "@/modules/costs/notifications";

// Generar el costeo desde la lista de ordenes (B6 de la 10.8b, D5), con el Radix real.
// No anula nada: confirma con el boton normal y dice lo que calcula el codigo. Con exito la
// accion redirige al costeo con su aviso en la URL (hallazgo 95): el boton no navega ni
// avisa por su cuenta; actions.test.ts fija el redirect y su clave.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/costs/work-orders",
  useSearchParams: () => new URLSearchParams(),
}));
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
  for (const fn of Object.values(navigation)) {
    fn.mockClear();
  }
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

const OT = "OTR00000009";
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

function actionWith(state: CostingFromWorkOrderState) {
  return vi.fn<(prev: CostingFromWorkOrderState, formData: FormData) => Promise<CostingFromWorkOrderState>>(
    async () => state,
  );
}

async function render(action: ReturnType<typeof actionWith>) {
  await act(async () =>
    root.render(
      h(GenerateCostingAction, {
        idOrdenTrabajo: OT,
        action,
      }),
    ),
  );
}

async function confirmGenerate() {
  await act(async () => buttonIn(host, "Generar costeo").click());
  await act(async () => buttonIn(confirmation()!, "Generar costeo").click());
  await settle();
}

describe("GenerateCostingAction", () => {
  it("confirma con el boton normal y dice lo que calcula", async () => {
    await render(actionWith({ status: "error", error: "x", values: { id_orden_trabajo: OT }, operationId: "op" }));

    await act(async () => buttonIn(host, "Generar costeo").click());

    expect(confirmation()?.textContent).toContain(`¿Generar el costeo de la orden ${OT}?`);
    expect(confirmation()?.textContent).toContain(
      "Calcula los materiales y consumibles con la receta guardada en la orden y el costo actual de cada material, y la mano de obra con las horas de sus tareas no anuladas y la tarifa de cada operario. Los costos indirectos empiezan en cero.",
    );
    expect(buttonIn(confirmation()!, "Generar costeo").getAttribute("data-variant")).toBe("default");
  });

  // La accion que redirige no responde: su promesa no se resuelve con un resultado. Aqui
  // queda pendiente, como mientras el reductor de Next aplica el redirect.
  it("envia la orden una vez y no avisa ni navega por su cuenta: la accion redirige", async () => {
    const action = vi.fn<(prev: CostingFromWorkOrderState, formData: FormData) => Promise<CostingFromWorkOrderState>>(
      () => new Promise<CostingFromWorkOrderState>(() => {}),
    );
    await render(action);

    await confirmGenerate();

    expect(action).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries(action.mock.calls[0]?.[1] as FormData)).toEqual({ id_orden_trabajo: OT });
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(Object.values(navigation).some((fn) => fn.mock.calls.length > 0)).toBe(false);
  });

  it("un rechazo queda dentro de la confirmacion, sin aviso ni navegacion", async () => {
    const message = "La versión de receta no tiene materiales registrados para calcular el costeo.";
    await render(actionWith({ status: "error", error: message, values: { id_orden_trabajo: OT }, operationId: "op" }));

    await confirmGenerate();

    expect(confirmation()?.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });
});

describe("aviso de costeo existente", () => {
  it("es informativo y dice que se abre el existente", () => {
    expect(costsNotifications["costing-already-exists"]).toEqual({
      type: "info",
      message: "La orden ya tenía un costeo: se abrió el existente",
    });
  });
});
