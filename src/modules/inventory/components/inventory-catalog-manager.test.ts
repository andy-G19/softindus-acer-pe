// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatusToggleState } from "@/lib/requested-status";
import type { InventoryCatalogFormState } from "@/modules/inventory/catalog-form-state";
import { InventoryCatalogManager } from "@/modules/inventory/components/inventory-catalog-manager";

// Filas de un catalogo de inventario (entrega 10, commit 8 de la 10.1), con el
// Radix real: el snapshot de la pagina no distingue un boton con confirmacion
// de uno sin ella, porque los dos pintan el mismo <button>. Inactivar pide
// confirmar con la entidad, el nombre y la consecuencia; activar se ejecuta al
// pulsar; cada uno envia el estado pedido y da su propio aviso.

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

function button(text: string) {
  const element = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  if (!element) {
    throw new Error(`No hay boton "${text}"`);
  }
  return element;
}

const confirmation = () => document.querySelector('[role="alertdialog"]');

const ACTIVATED = { type: "success" as const, message: "Tipo de proveedor activado" };
const DEACTIVATED = { type: "warning" as const, message: "Tipo de proveedor desactivado" };

const ITEMS = [
  { id: "TPR00000001", nombre: "Distribuidor", slug: "distribuidor", descripcion: null, estado: true },
  { id: "TPR00000002", nombre: "Fabricante", slug: "fabricante", descripcion: "Directo", estado: false },
];

async function renderManager(canManage = true) {
  const toggleAction = vi.fn(
    async (_prev: StatusToggleState, formData: FormData): Promise<StatusToggleState> => ({
      status: "success",
      data: { estado: formData.get("estado") === "true" },
      values: { id: String(formData.get("id_tipo_proveedor")) },
      operationId: crypto.randomUUID(),
    }),
  );

  await act(async () =>
    root.render(
      h(InventoryCatalogManager, {
        idFieldName: "id_tipo_proveedor",
        items: ITEMS,
        updateAction: async (): Promise<InventoryCatalogFormState> => ({ status: "idle" }),
        updateNotification: { type: "success", message: "Registro actualizado correctamente" },
        toggleAction,
        activatedNotification: ACTIVATED,
        deactivatedNotification: DEACTIVATED,
        entityLabel: "el tipo de proveedor",
        inactivateConsequence: "Dejará de ofrecerse al registrar proveedores.",
        canManage,
        editTitle: "Editar tipo de proveedor",
        discardTitle: "¿Descartar el tipo de proveedor?",
        emptyMessage: "Todavía no hay tipos de proveedor registrados.",
      }),
    ),
  );

  return toggleAction;
}

describe("InventoryCatalogManager", () => {
  it("inactivar pide confirmar con la entidad, el nombre y la consecuencia, y envia el estado pedido", async () => {
    const toggleAction = await renderManager();

    await act(async () => button("Inactivar").click());

    expect(confirmation()?.textContent).toContain("¿Inactivar el tipo de proveedor Distribuidor?");
    expect(confirmation()?.textContent).toContain("Dejará de ofrecerse al registrar proveedores.");
    expect(toggleAction).not.toHaveBeenCalled();

    await act(async () => [...confirmation()!.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Inactivar")!.click());
    await settle();

    expect(Object.fromEntries(toggleAction.mock.calls[0][1])).toEqual({ id_tipo_proveedor: "TPR00000001", estado: "false" });
    expect(notifications.notify).toHaveBeenCalledWith(DEACTIVATED);
    expect(confirmation()).toBeNull();
  });

  it("activar se ejecuta al pulsar, sin confirmacion, con su propio aviso", async () => {
    const toggleAction = await renderManager();

    await act(async () => button("Activar").click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(Object.fromEntries(toggleAction.mock.calls[0][1])).toEqual({ id_tipo_proveedor: "TPR00000002", estado: "true" });
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
  });

  it("quien no gestiona solo consulta", async () => {
    await renderManager(false);

    expect(document.body.textContent).toContain("Solo lectura");
    expect([...document.querySelectorAll("button")].map((item) => item.textContent?.trim())).toEqual([]);
  });
});
