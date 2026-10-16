// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import type { InventoryCatalogFormState, InventoryCatalogFormValues } from "@/modules/inventory/catalog-form-state";
import { InventoryCatalogDialog } from "@/modules/inventory/components/inventory-catalog-dialog";

// Catalogo de inventario en ventana modal (entrega 10), con el Radix real: el
// mismo contrato que las categorias de producto. La abre su boton con el foco
// en el nombre; al editar muestra los datos y envia el id; con error conserva
// lo escrito, enfoca el campo y no da un toast; al guardar da un solo aviso,
// se cierra y devuelve el foco; con cambios, cerrar pide confirmar el
// descarte, y mientras guarda no se cierra.

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

const dialog = () => document.querySelector('[role="dialog"]');
const confirmation = () => document.querySelector('[role="alertdialog"]');
const field = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const SAVED = { type: "success" as const, message: "Registro creado correctamente" };

const ITEM = { id: "TPR00000003", nombre: "Distribuidor", slug: "distribuidor", descripcion: null };

function valuesOf(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    descripcion: String(formData.get("descripcion") ?? ""),
  } satisfies InventoryCatalogFormValues;
}

async function renderDialog(
  respond: (values: InventoryCatalogFormValues) => InventoryCatalogFormState | Promise<InventoryCatalogFormState>,
  item?: typeof ITEM,
) {
  const action = vi.fn(async (_prev: InventoryCatalogFormState, formData: FormData) => respond(valuesOf(formData)));

  await act(async () =>
    root.render(
      h(InventoryCatalogDialog, {
        action,
        idFieldName: "id_tipo_proveedor",
        item,
        title: item ? "Editar tipo de proveedor" : "Nuevo tipo de proveedor",
        submitLabel: item ? "Guardar cambios" : "Crear",
        successNotification: SAVED,
        discardTitle: "¿Descartar el tipo de proveedor?",
        trigger: h(Button, { type: "button" }, item ? "Editar" : "Nuevo tipo"),
      }),
    ),
  );

  return action;
}

async function openWith(text: string) {
  const trigger = button(text);
  trigger.focus();
  await act(async () => trigger.click());
  return trigger;
}

describe("InventoryCatalogDialog", () => {
  it("la abre su boton, con el titulo y el foco en el nombre", async () => {
    await renderDialog(() => ({ status: "idle" }));
    expect(dialog()).toBeNull();

    await openWith("Nuevo tipo");

    expect(dialog()?.textContent).toContain("Nuevo tipo de proveedor");
    expect(document.activeElement).toBe(field("catalogo-nombre"));
    expect(field<HTMLInputElement>("catalogo-slug").required).toBe(true);
  });

  it("al editar muestra los datos, envia el id y el codigo describe la ventana", async () => {
    const action = await renderDialog((values) => ({ status: "success", data: { id: ITEM.id }, values, operationId: "op-1" }), ITEM);

    await openWith("Editar");

    expect(field<HTMLInputElement>("catalogo-nombre").value).toBe("Distribuidor");
    expect(field<HTMLInputElement>("catalogo-slug").value).toBe("distribuidor");
    expect(field<HTMLTextAreaElement>("catalogo-descripcion").value).toBe("");
    const describedBy = dialog()?.getAttribute("aria-describedby");
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe("TPR00000003");

    await act(async () => document.querySelector("form")!.requestSubmit());

    expect(action.mock.calls[0][1].get("id_tipo_proveedor")).toBe("TPR00000003");
  });

  it("con error conserva lo escrito, enfoca el campo invalido y no da un toast", async () => {
    await renderDialog((values) => ({
      status: "error",
      error: "Revisa los datos del tipo de proveedor.",
      fieldErrors: { slug: ["El slug solo puede usar minúsculas, números y guiones bajos."] },
      values,
      operationId: "op-2",
    }));
    await openWith("Nuevo tipo");
    field<HTMLInputElement>("catalogo-nombre").value = "Distribuidor";
    field<HTMLInputElement>("catalogo-slug").value = "Distribuidor-Mayorista";
    field<HTMLTextAreaElement>("catalogo-descripcion").value = "Por volumen";

    await act(async () => document.querySelector("form")!.requestSubmit());

    expect(dialog()).not.toBeNull();
    expect(field<HTMLInputElement>("catalogo-nombre").value).toBe("Distribuidor");
    expect(field<HTMLInputElement>("catalogo-slug").value).toBe("Distribuidor-Mayorista");
    expect(field<HTMLTextAreaElement>("catalogo-descripcion").value).toBe("Por volumen");
    expect(document.activeElement).toBe(field("catalogo-slug"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos del tipo de proveedor.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso, se cierra y devuelve el foco al boton", async () => {
    await renderDialog((values) => ({ status: "success", data: { id: "TPR00000010" }, values, operationId: "op-3" }));
    const trigger = await openWith("Nuevo tipo");
    const nombre = field<HTMLInputElement>("catalogo-nombre");
    nombre.value = "Mayorista";
    field<HTMLInputElement>("catalogo-slug").value = "mayorista";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => document.querySelector("form")!.requestSubmit());
    await settle();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(SAVED);
    expect(confirmation()).toBeNull();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("con cambios, cerrar pide confirmar el descarte; sin cambios cierra", async () => {
    await renderDialog(() => ({ status: "idle" }));
    await openWith("Nuevo tipo");

    await act(async () => button("Cancelar").click());
    expect(dialog()).toBeNull();

    await openWith("Nuevo tipo");
    const nombre = field<HTMLInputElement>("catalogo-nombre");
    nombre.value = "Mayorista";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));
    await act(async () => button("Cancelar").click());

    expect(confirmation()?.textContent).toContain("¿Descartar el tipo de proveedor?");
    await act(async () => button("Descartar cambios").click());
    await settle();
    expect(dialog()).toBeNull();
  });

  it("mientras guarda no se cierra", async () => {
    let finish: (state: InventoryCatalogFormState) => void = () => {};
    await renderDialog(() => new Promise<InventoryCatalogFormState>((resolve) => (finish = resolve)));
    await openWith("Nuevo tipo");
    field<HTMLInputElement>("catalogo-nombre").value = "Mayorista";
    field<HTMLInputElement>("catalogo-slug").value = "mayorista";

    await act(async () => document.querySelector("form")!.requestSubmit());
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click());

    expect(dialog()).not.toBeNull();
    await act(async () => finish({ status: "idle" }));
  });
});
