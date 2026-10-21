// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatusToggleState } from "@/lib/requested-status";
import { SupplierStatusButton } from "@/modules/inventory/suppliers/supplier-status-button";

// Activar e inactivar un proveedor desde su fila (entrega 10.3b), con el Radix
// real: el snapshot de la pagina no distingue un boton con confirmacion de uno
// sin ella. Inactivar confirma con la razon social y la consecuencia; activar
// se ejecuta al pulsar; los dos envian el estado pedido. Un error de la accion
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

const ACTIVATED = { type: "success" as const, message: "Proveedor activado" };
const DEACTIVATED = { type: "warning" as const, message: "Proveedor desactivado" };

type Respond = (formData: FormData) => StatusToggleState;

const succeed: Respond = (formData) => ({
  status: "success",
  data: { estado: formData.get("estado") === "true" },
  values: { id: String(formData.get("id_proveedor")) },
  operationId: crypto.randomUUID(),
});

async function renderButton(estado: boolean, respond: Respond = succeed) {
  const action = vi.fn(async (_prev: StatusToggleState, formData: FormData) => respond(formData));

  await act(async () =>
    root.render(
      h(SupplierStatusButton, {
        supplier: { id_proveedor: "PVE00000004", razon_social: "Aceros del Sur S.A.C.", estado },
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

describe("SupplierStatusButton", () => {
  it("inactivar confirma con la razon social y la consecuencia y envia estado false", async () => {
    const action = await renderButton(true);

    await act(async () => buttonIn(document, "Inactivar").click());

    expect(confirmation()?.textContent).toContain("¿Inactivar el proveedor Aceros del Sur S.A.C.?");
    expect(confirmation()?.textContent).toContain("Dejará de ofrecerse en compras, repuestos y asociaciones nuevas con materiales");
    expect(confirmation()?.textContent).toContain("no contará en Proveedores activos");
    expect(confirmation()?.textContent).toContain("Sus compras, pagos y asociaciones se conservan.");
    expect(buttonIn(confirmation()!, "Inactivar").getAttribute("data-variant")).toBe("destructive");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_proveedor: "PVE00000004", estado: "false" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(DEACTIVATED);
    expect(confirmation()).toBeNull();
  });

  it("si otro ya lo inactivo, el mensaje queda en la confirmacion sin aviso", async () => {
    await renderButton(true, (formData) => ({
      status: "error",
      error: "El proveedor ya estaba inactivo.",
      values: { id: String(formData.get("id_proveedor")) },
      operationId: crypto.randomUUID(),
    }));

    await act(async () => buttonIn(document, "Inactivar").click());
    await act(async () => buttonIn(confirmation()!, "Inactivar").click());
    await settle();

    expect(confirmation()?.textContent).toContain("El proveedor ya estaba inactivo.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("activar se ejecuta al pulsar y envia estado true", async () => {
    const action = await renderButton(false);

    await act(async () => buttonIn(document, "Activar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_proveedor: "PVE00000004", estado: "true" });
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
  });
});
