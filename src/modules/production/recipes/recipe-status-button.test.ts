// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatusToggleState } from "@/lib/requested-status";
import { RecipeStatusButton } from "@/modules/production/recipes/recipe-status-button";

// Activar e inactivar una receta desde su fila (entrega 10.6b), con el Radix real:
// el snapshot de la pagina no distingue un boton con confirmacion de uno sin ella.
// Inactivar confirma con el nombre y la consecuencia real; activar se ejecuta al
// pulsar; los dos envian el estado pedido. Un error queda dentro de la confirmacion.

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

const ACTIVATED = { type: "success" as const, message: "Activada" };
const DEACTIVATED = { type: "warning" as const, message: "Desactivada" };

type Respond = (formData: FormData) => StatusToggleState;

const succeed: Respond = (formData) => ({
  status: "success",
  data: { estado: formData.get("estado") === "true" },
  values: { id: "ID" },
  operationId: crypto.randomUUID(),
});

function buttonIn(scope: ParentNode, text: string) {
  return [...scope.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;
}

async function renderRecipe(estado: string, respond: Respond = succeed) {
  const action = vi.fn(async (_prev: StatusToggleState, formData: FormData) => respond(formData));

  await act(async () =>
    root.render(
      h(RecipeStatusButton, {
        recipe: { id_receta: "REC00000003", nombre_receta: "Receta de lampa", estado },
        action,
        activatedNotification: ACTIVATED,
        deactivatedNotification: DEACTIVATED,
      }),
    ),
  );

  return action;
}

describe("RecipeStatusButton", () => {
  it("inactivar confirma con el nombre y la consecuencia y envia estado false", async () => {
    const action = await renderRecipe("activa");

    await act(async () => buttonIn(document, "Inactivar").click());

    expect(confirmation()?.textContent).toContain("¿Inactivar la receta Receta de lampa?");
    expect(confirmation()?.textContent).toContain("Dejará de ofrecerse en las órdenes de trabajo nuevas");
    expect(confirmation()?.textContent).toContain("no admitirá versiones nuevas ni cambios en sus materiales");
    expect(confirmation()?.textContent).toContain("Sus versiones y las órdenes ya creadas se conservan");
    expect(buttonIn(confirmation()!, "Inactivar").getAttribute("data-variant")).toBe("destructive");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_receta: "REC00000003", estado: "false" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(DEACTIVATED);
    expect(confirmation()).toBeNull();
  });

  it("si otro ya la inactivo, el mensaje queda en la confirmacion sin aviso", async () => {
    await renderRecipe("activa", () => ({
      status: "error",
      error: "La receta ya estaba inactiva.",
      values: { id: "REC00000003" },
      operationId: crypto.randomUUID(),
    }));

    await act(async () => buttonIn(document, "Inactivar").click());
    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(confirmation()?.textContent).toContain("La receta ya estaba inactiva.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("activar se ejecuta al pulsar y envia estado true", async () => {
    const action = await renderRecipe("inactiva");

    await act(async () => buttonIn(document, "Activar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_receta: "REC00000003", estado: "true" });
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
  });
});
