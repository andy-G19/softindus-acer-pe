// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatusToggleState } from "@/lib/requested-status";
import { ExpenseCategoryStatusButton } from "@/modules/petty-cash/categories/expense-category-status-button";

// Activar e inactivar una categoria de gasto (entrega 10, commit 12 de la
// 10.1), con el Radix real: el snapshot de la pagina no distingue un boton con
// confirmacion de uno sin ella. Inactivar confirma con el nombre y la
// consecuencia; activar se ejecuta al pulsar; los dos envian el estado pedido.

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

const ACTIVATED = { type: "success" as const, message: "Categoría de gasto activada" };
const DEACTIVATED = { type: "warning" as const, message: "Categoría de gasto desactivada" };

async function renderButton(estado: boolean) {
  const action = vi.fn(
    async (_prev: StatusToggleState, formData: FormData): Promise<StatusToggleState> => ({
      status: "success",
      data: { estado: formData.get("estado") === "true" },
      values: { id: String(formData.get("id_categoria_gasto")) },
      operationId: crypto.randomUUID(),
    }),
  );

  await act(async () =>
    root.render(
      h(ExpenseCategoryStatusButton, {
        category: { id_categoria_gasto: "CGA00000004", nombre_categoria: "Fletes", estado },
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

describe("ExpenseCategoryStatusButton", () => {
  it("inactivar confirma con el nombre y la consecuencia y envia estado false", async () => {
    const action = await renderButton(true);

    await act(async () => buttonIn(document, "Inactivar").click());

    expect(confirmation()?.textContent).toContain("¿Inactivar la categoría de gasto Fletes?");
    expect(confirmation()?.textContent).toContain("Dejará de ofrecerse al registrar gastos de caja chica");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_categoria_gasto: "CGA00000004", estado: "false" });
    expect(notifications.notify).toHaveBeenCalledWith(DEACTIVATED);
    expect(confirmation()).toBeNull();
  });

  it("activar se ejecuta al pulsar y envia estado true", async () => {
    const action = await renderButton(false);

    await act(async () => buttonIn(document, "Activar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_categoria_gasto: "CGA00000004", estado: "true" });
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
  });
});
