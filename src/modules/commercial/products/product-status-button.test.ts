// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatusToggleState } from "@/lib/requested-status";
import { ProductStatusButton } from "@/modules/commercial/products/product-status-button";

// Activar e inactivar un producto desde su fila (entrega 10.4a), con el Radix
// real: el snapshot de la pagina no distingue un boton con confirmacion de uno
// sin ella. Inactivar confirma con el nombre y la consecuencia; activar se
// ejecuta al pulsar; los dos envian el estado pedido. Un error de la accion
// queda dentro de la confirmacion.

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

const ACTIVATED = { type: "success" as const, message: "Producto activado" };
const DEACTIVATED = { type: "warning" as const, message: "Producto desactivado" };

type Respond = (formData: FormData) => StatusToggleState;

const succeed: Respond = (formData) => ({
  status: "success",
  data: { estado: formData.get("estado") === "true" },
  values: { id: String(formData.get("id_producto")) },
  operationId: crypto.randomUUID(),
});

async function renderButton(estado: boolean, respond: Respond = succeed) {
  const action = vi.fn(async (_prev: StatusToggleState, formData: FormData) => respond(formData));

  await act(async () =>
    root.render(
      h(ProductStatusButton, {
        product: { id_producto: "PRO00000004", nombre_producto: "Lampa agrícola reforzada", estado },
        action,
        activatedNotification: ACTIVATED,
        deactivatedNotification: DEACTIVATED,
      }),
    ),
  );

  return action;
}

function buttonIn(scope: ParentNode, text: string) {
  return [...scope.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;
}

describe("ProductStatusButton", () => {
  it("inactivar confirma con el nombre y la consecuencia y envia estado false", async () => {
    const action = await renderButton(true);

    await act(async () => buttonIn(document, "Inactivar").click());

    expect(confirmation()?.textContent).toContain("¿Inactivar el producto Lampa agrícola reforzada?");
    expect(confirmation()?.textContent).toContain(
      "Dejará de ofrecerse en pedidos, rutas de fabricación, recetas técnicas nuevas, campañas y órdenes de trabajo",
    );
    expect(confirmation()?.textContent).toContain("no contará en Productos activos");
    expect(confirmation()?.textContent).toContain("Sus pedidos, rutas, recetas y órdenes se conservan.");
    expect(buttonIn(confirmation()!, "Inactivar").getAttribute("data-variant")).toBe("destructive");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_producto: "PRO00000004", estado: "false" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(DEACTIVATED);
    expect(confirmation()).toBeNull();
  });

  it("si otro ya lo inactivo, el mensaje queda en la confirmacion sin aviso", async () => {
    await renderButton(true, (formData) => ({
      status: "error",
      error: "El producto ya estaba inactivo.",
      values: { id: String(formData.get("id_producto")) },
      operationId: crypto.randomUUID(),
    }));

    await act(async () => buttonIn(document, "Inactivar").click());
    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(confirmation()?.textContent).toContain("El producto ya estaba inactivo.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("activar se ejecuta al pulsar y envia estado true", async () => {
    const action = await renderButton(false);

    await act(async () => buttonIn(document, "Activar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_producto: "PRO00000004", estado: "true" });
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
  });
});
