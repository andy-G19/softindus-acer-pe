// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { commercialNotifications } from "@/modules/commercial/notifications";
import type { ProductFormState, ProductFormValues } from "@/modules/commercial/products/actions";
import { ProductForm } from "@/modules/commercial/products/product-form";

// Formulario de productos con React real (entrega 10.4a), con el patron de
// Clientes, Materiales y Proveedores: la accion devuelve un resultado en lugar
// de redirigir, y el formulario decide. Con error conserva lo escrito, enfoca
// el primer campo invalido y muestra el error dentro sin un segundo aviso
// (antes daba ademas un toast de error y React vaciaba los campos); con exito
// da un solo aviso y vuelve al returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/commercial/products/new",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

// jsdom no trae ResizeObserver y el cuerpo del panel lo usa.
class ResizeObserverDouble {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  for (const fn of Object.values(navigation)) {
    fn.mockClear();
  }
  notifications.notify.mockClear();
  notifications.showError.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const LIST = "/dashboard/commercial/products";
const CATEGORIES = [
  { slug: "estructuras", nombre: "Estructuras metálicas" },
  { slug: "herramientas", nombre: "Herramientas agrícolas" },
];

function field<T extends HTMLElement>(id: string) {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`No hay campo ${id}`);
  }
  return element;
}

const submitButton = () => document.querySelector<HTMLButtonElement>('button[type="submit"]')!;
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;

function valuesOf(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as ProductFormValues;
}

type Respond = (values: ProductFormValues) => ProductFormState;

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: ProductFormState, formData: FormData) => respond(valuesOf(formData)));

  return {
    action,
    props: {
      action,
      categories: CATEGORIES,
      submitLabel: "Guardar producto",
      successNotification: commercialNotifications["product-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(ProductForm, props)));

  return action;
}

// Los campos obligatorios: sin ellos, requestSubmit no envia (validacion nativa).
function fillRequired() {
  field<HTMLInputElement>("nombre_producto").value = "Lampa agrícola reforzada";
  field<HTMLSelectElement>("categoria").value = "herramientas";
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

const success: Respond = (values) => ({
  status: "success",
  data: { id_producto: "PRO00000010" },
  values,
  operationId: "op-ok",
});

describe("ProductForm", () => {
  it("con error conserva lo escrito, enfoca el campo invalido y no da ningun otro aviso", async () => {
    await renderForm((values) => ({
      status: "error",
      error: "Ya existe un producto con ese nombre.",
      fieldErrors: { nombre_producto: ["Ya existe un producto con ese nombre."] },
      values,
      operationId: "op-1",
    }));
    fillRequired();
    field<HTMLSelectElement>("unidad_medida").value = "docena";
    field<HTMLInputElement>("precio_referencial").value = "35.50";
    field<HTMLTextAreaElement>("descripcion").value = "Mango de eucalipto.";

    await submit();

    expect(field<HTMLInputElement>("nombre_producto").value).toBe("Lampa agrícola reforzada");
    expect(field<HTMLSelectElement>("categoria").value).toBe("herramientas");
    expect(field<HTMLSelectElement>("unidad_medida").value).toBe("docena");
    expect(field<HTMLInputElement>("precio_referencial").value).toBe("35.50");
    expect(field<HTMLTextAreaElement>("descripcion").value).toBe("Mango de eucalipto.");
    expect(document.activeElement).toBe(field("nombre_producto"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Ya existe un producto con ese nombre.");
    expect(field("nombre_producto-error").textContent).toBe("Ya existe un producto con ese nombre.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success, { returnTo: LIST });
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Producto guardado correctamente" });
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que el producto puede no aparecer", async () => {
    const returnTo = `${LIST}?status=inactive`;
    await renderForm(success, { returnTo });
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      type: "success",
      message: "Producto guardado correctamente",
      description: "Puede no aparecer con los filtros activos del listado.",
    });
    expect(navigation.push).toHaveBeenCalledWith(returnTo);
  });

  it("el alta empieza con la unidad Unidad y Cancelar vuelve al returnTo sin enviar", async () => {
    const returnTo = `${LIST}?q=lampa`;
    const action = await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(field<HTMLSelectElement>("unidad_medida").value).toBe("unidad");
    expect(cancel?.getAttribute("href")).toBe(returnTo);
    expect(action).not.toHaveBeenCalled();
  });

  it("la edicion abre con los datos del producto y envia su id", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      successNotification: commercialNotifications["product-updated"],
      defaultValues: {
        id_producto: "PRO00000004",
        nombre_producto: "Lampa agrícola reforzada",
        categoria: "estructuras",
        unidad_medida: "docena",
        precio_referencial: "35.5",
        descripcion: "Mango de eucalipto.",
      },
    });

    expect(field<HTMLSelectElement>("categoria").value).toBe("estructuras");
    expect(field<HTMLSelectElement>("unidad_medida").value).toBe("docena");
    expect(field<HTMLInputElement>("precio_referencial").value).toBe("35.5");

    await submit();

    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id_producto")).toBe("PRO00000004");
    expect(sent.get("categoria")).toBe("estructuras");
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Producto actualizado correctamente" });
  });

  it("sin categorias activas avisa con el enlace y no deja guardar", async () => {
    await renderForm(success, { categories: [] });

    expect(host.textContent).toContain("No hay categorías activas disponibles.");
    expect(document.querySelector('a[href="/dashboard/commercial/product-categories"]')).not.toBeNull();
    expect(field<HTMLSelectElement>("categoria").disabled).toBe(true);
    expect(submitButton().disabled).toBe(true);
  });
});

// En el panel lateral (entrega 10.4a): el mismo formulario dentro de un RouteSheet.
describe("ProductForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { action, props } = formProps(respond, { returnTo: `${LIST}?q=lampa` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nuevo producto",
          discardTitle: "¿Descartar el producto nuevo?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(ProductForm, props),
        }),
      ),
    );

    return action;
  }

  const form = () => document.querySelector("form")!;

  it("el foco empieza en el primer campo y Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    expect(document.activeElement?.id).toBe("nombre_producto");
    expect([...document.querySelectorAll("a")].some((link) => link.textContent === "Cancelar")).toBe(false);

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const nombre = field<HTMLInputElement>("nombre_producto");
    nombre.value = "Lampa";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar el producto nuevo?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    fillRequired();
    await act(async () => field("nombre_producto").dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => form().requestSubmit());

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("con error el panel sigue abierto con lo escrito y el foco en el campo invalido", async () => {
    await renderInPanel((values) => ({
      status: "error",
      error: "Selecciona una categoría activa.",
      fieldErrors: { categoria: ["Selecciona una categoría activa."] },
      values,
      operationId: "op-10",
    }));
    fillRequired();

    await act(async () => form().requestSubmit());

    expect(navigation.back).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(field<HTMLInputElement>("nombre_producto").value).toBe("Lampa agrícola reforzada");
    expect(document.activeElement?.id).toBe("categoria");
  });
});
