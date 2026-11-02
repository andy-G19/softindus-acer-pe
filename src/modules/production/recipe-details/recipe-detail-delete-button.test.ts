// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeDetailDeleteState } from "@/modules/production/recipe-details/actions";
import { RecipeDetailDeleteButton } from "@/modules/production/recipe-details/recipe-detail-delete-button";

// Eliminar una linea desde su fila (entrega 10.6b), con el Radix real: confirma con
// el material y la consecuencia, envia su id y un error queda en la confirmacion.

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
const DELETED = { type: "warning" as const, message: "Eliminado" };

function buttonIn(scope: ParentNode, text: string) {
  return [...scope.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;
}

async function renderButton(state: RecipeDetailDeleteState) {
  const action = vi.fn<(prev: RecipeDetailDeleteState, formData: FormData) => Promise<RecipeDetailDeleteState>>(async () => state);

  await act(async () =>
    root.render(
      h(RecipeDetailDeleteButton, {
        detail: { id_detalle_receta: "DRE00000007", material: { nombre_material: "Plancha de acero" } },
        action,
        deletedNotification: DELETED,
      }),
    ),
  );

  return action;
}

describe("RecipeDetailDeleteButton", () => {
  it("confirma con el material y envia su id", async () => {
    const action = await renderButton({
      status: "success",
      data: { id_detalle_receta: "DRE00000007" },
      values: { id_detalle_receta: "DRE00000007" },
      operationId: "op",
    });

    await act(async () => buttonIn(document, "Eliminar").click());

    expect(confirmation()?.textContent).toContain("¿Eliminar material de la receta?");
    expect(confirmation()?.textContent).toContain("Se quitará Plancha de acero de esta versión.");
    expect(buttonIn(confirmation()!, "Eliminar").getAttribute("data-variant")).toBe("destructive");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Eliminar").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_detalle_receta: "DRE00000007" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(DELETED);
  });

  it("un error queda en la confirmacion sin aviso", async () => {
    await renderButton({
      status: "error",
      error: "La receta técnica no está activa.",
      values: { id_detalle_receta: "DRE00000007" },
      operationId: "op",
    });

    await act(async () => buttonIn(document, "Eliminar").click());
    await act(async () => buttonIn(confirmation()!, "Eliminar").click());
    await settle();

    expect(confirmation()?.textContent).toContain("La receta técnica no está activa.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
