// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import type {
  ProductCategoryFormState,
  ProductCategoryFormValues,
} from "@/modules/commercial/products/actions";
import { ProductCategoryDialog } from "@/modules/commercial/products/product-category-dialog";

// Categoria de producto en ventana modal (entrega 9), con el Radix real. Es la
// variante sin URL del piloto: la abre su boton, el foco empieza en el nombre,
// con error conserva lo escrito y enfoca el campo sin un toast duplicado, al
// guardar da un solo aviso, se cierra y devuelve el foco al boton; con cambios
// pendientes, cerrar pide confirmar el descarte y, mientras guarda, no se
// cierra.

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

const SAVED = { type: "success" as const, message: "Categoría creada correctamente" };

function valuesOf(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? ""),
    descripcion: String(formData.get("descripcion") ?? ""),
  } satisfies ProductCategoryFormValues;
}

async function renderDialog(
  respond: (values: ProductCategoryFormValues) => ProductCategoryFormState | Promise<ProductCategoryFormState>,
  category?: { id_categoria_producto: string; nombre: string; descripcion: string | null },
) {
  const action = vi.fn(async (_prev: ProductCategoryFormState, formData: FormData) => respond(valuesOf(formData)));

  await act(async () =>
    root.render(
      h(ProductCategoryDialog, {
        action,
        category,
        title: category ? "Editar categoría" : "Nueva categoría",
        submitLabel: category ? "Guardar cambios" : "Crear categoría",
        successNotification: SAVED,
        trigger: h(Button, { type: "button" }, category ? "Editar" : "Nueva categoría"),
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

describe("ProductCategoryDialog", () => {
  it("la abre su boton, con el foco en el nombre", async () => {
    await renderDialog(() => ({ status: "idle" }));
    expect(dialog()).toBeNull();

    await openWith("Nueva categoría");

    expect(dialog()?.textContent).toContain("Nueva categoría");
    expect(document.activeElement).toBe(field("categoria-nombre"));
  });

  it("al editar muestra los datos de la categoria", async () => {
    await renderDialog(() => ({ status: "idle" }), {
      id_categoria_producto: "CPR00000004",
      nombre: "Herramientas",
      descripcion: null,
    });

    await openWith("Editar");

    expect(field<HTMLInputElement>("categoria-nombre").value).toBe("Herramientas");
    expect(field<HTMLTextAreaElement>("categoria-descripcion").value).toBe("");
    expect(document.querySelector<HTMLInputElement>('input[name="id_categoria_producto"]')?.value).toBe("CPR00000004");
    const describedBy = dialog()?.getAttribute("aria-describedby");
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe("CPR00000004");
  });

  it("con error conserva lo escrito, enfoca el nombre y no da un toast", async () => {
    await renderDialog((values) => ({
      status: "error",
      error: "Ya existe una categoría de producto con ese nombre.",
      fieldErrors: { nombre: ["Ya existe una categoría de producto con ese nombre."] },
      values,
      operationId: "op-1",
    }));
    await openWith("Nueva categoría");
    field<HTMLInputElement>("categoria-nombre").value = "Herramientas";
    field<HTMLTextAreaElement>("categoria-descripcion").value = "Uso interno";

    await act(async () => document.querySelector("form")!.requestSubmit());

    expect(dialog()).not.toBeNull();
    expect(field<HTMLInputElement>("categoria-nombre").value).toBe("Herramientas");
    expect(field<HTMLTextAreaElement>("categoria-descripcion").value).toBe("Uso interno");
    expect(document.activeElement).toBe(field("categoria-nombre"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Ya existe una categoría");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso, se cierra y devuelve el foco al boton", async () => {
    await renderDialog((values) => ({ status: "success", data: { id_categoria_producto: "CPR00000010" }, values, operationId: "op-2" }));
    const trigger = await openWith("Nueva categoría");
    const nombre = field<HTMLInputElement>("categoria-nombre");
    nombre.value = "Soldadura";
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
    await openWith("Nueva categoría");

    await act(async () => button("Cancelar").click());
    expect(dialog()).toBeNull();

    await openWith("Nueva categoría");
    const nombre = field<HTMLInputElement>("categoria-nombre");
    nombre.value = "Soldadura";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));
    await act(async () => button("Cancelar").click());

    expect(confirmation()?.textContent).toContain("¿Descartar la categoría?");
    await act(async () => button("Descartar cambios").click());
    await settle();
    expect(dialog()).toBeNull();
  });

  it("mientras guarda no se cierra", async () => {
    let finish: (state: ProductCategoryFormState) => void = () => {};
    await renderDialog(() => new Promise<ProductCategoryFormState>((resolve) => (finish = resolve)));
    await openWith("Nueva categoría");
    field<HTMLInputElement>("categoria-nombre").value = "Soldadura";

    await act(async () => document.querySelector("form")!.requestSubmit());
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click());

    expect(dialog()).not.toBeNull();
    await act(async () => finish({ status: "idle" }));
  });
});
