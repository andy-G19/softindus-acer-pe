// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import type { ExpenseCategoryFormState, ExpenseCategoryFormValues } from "@/modules/petty-cash/categories/actions";
import { ExpenseCategoryDialog, ExpenseCategoryForm } from "@/modules/petty-cash/categories/expense-category-form";

// Formulario de categoria de gasto (entrega 10), con el Radix real: en la
// ventana modal de la lista y en la pagina de edicion. No tiene campo Estado.
// En la ventana, guardar da un solo aviso y la cierra; en la pagina, vuelve a
// la lista. Con error conserva lo escrito y enfoca el campo, sin toast.

const notifications = vi.hoisted(() => ({ notify: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

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
  router.push.mockClear();
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

const SAVED = { type: "success" as const, message: "Categoría de gasto creada correctamente" };
const CATEGORY = { id_categoria_gasto: "CGA00000004", nombre_categoria: "Fletes", descripcion: null };

function valuesOf(formData: FormData) {
  return {
    nombre_categoria: String(formData.get("nombre_categoria") ?? ""),
    descripcion: String(formData.get("descripcion") ?? ""),
  } satisfies ExpenseCategoryFormValues;
}

function actionWith(respond: (values: ExpenseCategoryFormValues) => ExpenseCategoryFormState | Promise<ExpenseCategoryFormState>) {
  return vi.fn(async (_prev: ExpenseCategoryFormState, formData: FormData) => respond(valuesOf(formData)));
}

async function renderDialog(action: ReturnType<typeof actionWith>, category?: typeof CATEGORY) {
  await act(async () =>
    root.render(
      h(ExpenseCategoryDialog, {
        action,
        category,
        title: category ? "Editar categoría de gasto" : "Nueva categoría de gasto",
        submitLabel: category ? "Guardar cambios" : "Guardar categoría",
        successNotification: SAVED,
        trigger: h(Button, { type: "button" }, category ? "Editar" : "Nueva categoría"),
      }),
    ),
  );
}

async function openWith(text: string) {
  const trigger = button(text);
  trigger.focus();
  await act(async () => trigger.click());
  return trigger;
}

describe("ExpenseCategoryDialog", () => {
  it("la abre su boton con el foco en el nombre y sin campo Estado", async () => {
    await renderDialog(actionWith(() => ({ status: "idle" })));

    await openWith("Nueva categoría");

    expect(dialog()?.textContent).toContain("Nueva categoría de gasto");
    expect(document.activeElement).toBe(field("nombre_categoria"));
    expect(dialog()!.querySelector('[name="estado"]')).toBeNull();
  });

  it("al editar muestra los datos, envia el id y el codigo describe la ventana", async () => {
    const action = actionWith((values) => ({ status: "success", data: { id_categoria_gasto: CATEGORY.id_categoria_gasto }, values, operationId: "op-1" }));
    await renderDialog(action, CATEGORY);

    await openWith("Editar");

    expect(field<HTMLInputElement>("nombre_categoria").value).toBe("Fletes");
    expect(field<HTMLTextAreaElement>("descripcion").value).toBe("");
    const describedBy = dialog()?.getAttribute("aria-describedby");
    expect(describedBy && document.getElementById(describedBy)?.textContent).toBe("CGA00000004");

    await act(async () => document.querySelector("form")!.requestSubmit());

    expect(action.mock.calls[0][1].get("id_categoria_gasto")).toBe("CGA00000004");
  });

  it("con error conserva lo escrito, enfoca el campo invalido y no da un toast", async () => {
    await renderDialog(
      actionWith((values) => ({
        status: "error",
        error: "Ya existe una categoria de gasto con ese nombre.",
        fieldErrors: { nombre_categoria: ["Ya existe una categoria de gasto con ese nombre."] },
        values,
        operationId: "op-2",
      })),
    );
    await openWith("Nueva categoría");
    field<HTMLInputElement>("nombre_categoria").value = "Fletes";
    field<HTMLTextAreaElement>("descripcion").value = "Taxis";

    await act(async () => document.querySelector("form")!.requestSubmit());

    expect(dialog()).not.toBeNull();
    expect(field<HTMLInputElement>("nombre_categoria").value).toBe("Fletes");
    expect(field<HTMLTextAreaElement>("descripcion").value).toBe("Taxis");
    expect(document.activeElement).toBe(field("nombre_categoria"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Ya existe una categoria de gasto");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso, se cierra, devuelve el foco al boton y no navega", async () => {
    await renderDialog(actionWith((values) => ({ status: "success", data: { id_categoria_gasto: "CGA00000010" }, values, operationId: "op-3" })));
    const trigger = await openWith("Nueva categoría");
    const nombre = field<HTMLInputElement>("nombre_categoria");
    nombre.value = "Fletes";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => document.querySelector("form")!.requestSubmit());
    await settle();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(SAVED);
    expect(confirmation()).toBeNull();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderDialog(actionWith(() => ({ status: "idle" })));
    await openWith("Nueva categoría");
    const nombre = field<HTMLInputElement>("nombre_categoria");
    nombre.value = "Fletes";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(confirmation()?.textContent).toContain("¿Descartar la categoría de gasto?");
    await act(async () => button("Descartar cambios").click());
    await settle();
    expect(dialog()).toBeNull();
  });
});

describe("ExpenseCategoryForm en la pagina de edicion", () => {
  async function renderPage(action: ReturnType<typeof actionWith>) {
    await act(async () =>
      root.render(
        h(ExpenseCategoryForm, { action, category: CATEGORY, submitLabel: "Guardar cambios", successNotification: SAVED }),
      ),
    );
  }

  it("sin campo Estado, con el enlace de vuelta a la lista", async () => {
    await renderPage(actionWith(() => ({ status: "idle" })));

    expect(document.querySelector('[name="estado"]')).toBeNull();
    expect(document.querySelector('a[href="/dashboard/petty-cash/categories"]')?.textContent).toBe("Volver al listado");
  });

  it("al guardar da un solo aviso y vuelve a la lista", async () => {
    await renderPage(actionWith((values) => ({ status: "success", data: { id_categoria_gasto: CATEGORY.id_categoria_gasto }, values, operationId: "op-4" })));

    await act(async () => document.querySelector("form")!.requestSubmit());
    await settle();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard/petty-cash/categories");
  });
});
