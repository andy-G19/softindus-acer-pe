// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatusToggleState } from "@/lib/requested-status";
import { SupplierMaterialStatusButton } from "@/modules/inventory/supplier-materials/supplier-material-status-button";

// Activar e inactivar una asociacion proveedor-material desde su fila
// (entrega 10.3b), con el Radix real: el snapshot de la pagina no distingue un
// boton con confirmacion de uno sin ella. Inactivar confirma con el proveedor,
// el material y la consecuencia; activar se ejecuta al pulsar; los dos envian
// el estado pedido. Un error de la accion queda dentro de la confirmacion.

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

const ACTIVATED = { type: "success" as const, message: "Asociación proveedor-material activada" };
const DEACTIVATED = { type: "warning" as const, message: "Asociación proveedor-material desactivada" };

type Respond = (formData: FormData) => StatusToggleState;

const succeed: Respond = (formData) => ({
  status: "success",
  data: { estado: formData.get("estado") === "true" },
  values: { id: String(formData.get("id_proveedor_material")) },
  operationId: crypto.randomUUID(),
});

async function renderButton(estado: boolean, respond: Respond = succeed) {
  const action = vi.fn(async (_prev: StatusToggleState, formData: FormData) => respond(formData));

  await act(async () =>
    root.render(
      h(SupplierMaterialStatusButton, {
        relation: {
          id_proveedor_material: "PVM00000004",
          estado,
          proveedor: { razon_social: "Aceros del Sur S.A.C." },
          material: { nombre_material: "Plancha LAC 1/16" },
        },
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

describe("SupplierMaterialStatusButton", () => {
  it("inactivar confirma con el proveedor, el material y la consecuencia y envia estado false", async () => {
    const action = await renderButton(true);

    await act(async () => buttonIn(document, "Inactivar").click());

    expect(confirmation()?.textContent).toContain("¿Inactivar la asociación Aceros del Sur S.A.C. – Plancha LAC 1/16?");
    expect(confirmation()?.textContent).toContain("Ninguna otra pantalla usa las asociaciones: no cambia compras ni stock.");
    expect(buttonIn(confirmation()!, "Inactivar").getAttribute("data-variant")).toBe("destructive");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_proveedor_material: "PVM00000004", estado: "false" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(DEACTIVATED);
    expect(confirmation()).toBeNull();
  });

  it("si otro ya la inactivo, el mensaje queda en la confirmacion sin aviso", async () => {
    await renderButton(true, (formData) => ({
      status: "error",
      error: "La asociación ya estaba inactiva.",
      values: { id: String(formData.get("id_proveedor_material")) },
      operationId: crypto.randomUUID(),
    }));

    await act(async () => buttonIn(document, "Inactivar").click());
    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(confirmation()?.textContent).toContain("La asociación ya estaba inactiva.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("activar se ejecuta al pulsar y envia estado true", async () => {
    const action = await renderButton(false);

    await act(async () => buttonIn(document, "Activar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_proveedor_material: "PVM00000004", estado: "true" });
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
  });
});
