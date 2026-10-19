// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import type { MaterialFormState, MaterialFormValues } from "@/modules/inventory/materials/actions";
import { MaterialForm } from "@/modules/inventory/materials/material-form";
import { inventoryNotifications } from "@/modules/inventory/notifications";

// Formulario de materiales con React real (entrega 10.3), con el patron de
// Clientes: la accion devuelve un resultado en lugar de redirigir, y el
// formulario decide. Con error conserva lo escrito, enfoca el primer campo
// invalido y muestra el error dentro sin un segundo aviso; con exito da un
// solo aviso y vuelve al returnTo que valido la pagina. La edicion muestra el
// stock de solo lectura y no lo envia.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/inventory/materials/new",
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
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const LIST = "/dashboard/inventory/materials";
const CATEGORIES = [
  { slug: "planchas", nombre: "Planchas" },
  { slug: "consumibles", nombre: "Consumibles" },
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
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as MaterialFormValues;
}

type Respond = (values: MaterialFormValues) => MaterialFormState;

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: MaterialFormState, formData: FormData) => respond(valuesOf(formData)));

  return {
    action,
    props: {
      action,
      categories: CATEGORIES,
      submitLabel: "Guardar material",
      mode: "create" as const,
      successNotification: inventoryNotifications["material-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(MaterialForm, props)));

  return action;
}

// Los campos obligatorios sin valor por defecto: sin ellos, requestSubmit no
// envia (validacion nativa).
function fillRequired() {
  field<HTMLInputElement>("nombre_material").value = "Plancha LAC 1/16";
  field<HTMLSelectElement>("categoria").value = "planchas";
  field<HTMLInputElement>("unidad_medida").value = "unidad";
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

const success: Respond = (values) => ({
  status: "success",
  data: { id_material: "MAT00000008" },
  values,
  operationId: "op-ok",
});

describe("MaterialForm", () => {
  it("con error conserva lo escrito, enfoca el campo invalido y no da un segundo aviso", async () => {
    await renderForm((values) => ({
      status: "error",
      error: "Revisa los datos del material.",
      fieldErrors: { stock_actual: ["El stock actual no puede ser menor que el stock reservado."] },
      values,
      operationId: "op-1",
    }));
    fillRequired();
    field<HTMLInputElement>("stock_actual").value = "2";
    field<HTMLInputElement>("stock_reservado").value = "3";

    await submit();

    expect(field<HTMLInputElement>("nombre_material").value).toBe("Plancha LAC 1/16");
    expect(field<HTMLSelectElement>("categoria").value).toBe("planchas");
    expect(field<HTMLInputElement>("stock_reservado").value).toBe("3");
    expect(document.activeElement).toBe(field("stock_actual"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos del material.");
    expect(field("stock_actual-error").textContent).toBe("El stock actual no puede ser menor que el stock reservado.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    const returnTo = `${LIST}?page=2`;
    await renderForm(success, { returnTo });
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Material guardado correctamente" });
    expect(navigation.push).toHaveBeenCalledWith(returnTo);
  });

  it("si el listado tiene filtros, el aviso explica que el material puede no aparecer", async () => {
    const returnTo = `${LIST}?status=inactive`;
    await renderForm(success, { returnTo });
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      type: "success",
      message: "Material guardado correctamente",
      description: "Puede no aparecer con los filtros activos del listado.",
    });
  });

  it("Cancelar vuelve al returnTo sin enviar", async () => {
    const returnTo = `${LIST}?q=plancha`;
    const action = await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(cancel?.getAttribute("href")).toBe(returnTo);
    expect(action).not.toHaveBeenCalled();
  });

  it("la edicion muestra el stock de solo lectura y no lo envia", async () => {
    const action = await renderForm(success, {
      mode: "edit",
      submitLabel: "Guardar cambios",
      successNotification: inventoryNotifications["material-updated"],
      defaultValues: {
        id_material: "MAT00000004",
        nombre_material: "Plancha LAC 1/16",
        categoria: "planchas",
        unidad_medida: "unidad",
        stock_actual: "12.00",
        stock_reservado: "2.00",
        stock_minimo: "5.00",
        costo_unitario_actual: "185.50",
      },
    });

    expect(document.querySelector('input[name="stock_actual"]')).toBeNull();
    expect(document.querySelector('input[name="stock_reservado"]')).toBeNull();
    expect(host.textContent).toContain("12.00");

    await submit();

    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id_material")).toBe("MAT00000004");
    expect(sent.has("stock_actual")).toBe(false);
    expect(sent.has("stock_reservado")).toBe(false);
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Material actualizado correctamente" });
  });

  it("sin categorias activas avisa con el enlace y no deja guardar", async () => {
    await renderForm(success, { categories: [] });

    expect(host.textContent).toContain("No hay categorías de materiales activas.");
    expect(document.querySelector('a[href="/dashboard/inventory/material-categories"]')).not.toBeNull();
    expect(field<HTMLSelectElement>("categoria").disabled).toBe(true);
    expect(submitButton().disabled).toBe(true);
  });
});

// En el panel lateral (entrega 10.3): el mismo formulario dentro de un RouteSheet.
describe("MaterialForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { action, props } = formProps(respond, { returnTo: `${LIST}?page=2` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nuevo material",
          discardTitle: "¿Descartar el material nuevo?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(MaterialForm, props),
        }),
      ),
    );

    return action;
  }

  const form = () => document.querySelector("form")!;

  it("el foco empieza en el primer campo y Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    expect(document.activeElement?.id).toBe("nombre_material");
    expect([...document.querySelectorAll("a")].some((link) => link.textContent === "Cancelar")).toBe(false);

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const nombre = field<HTMLInputElement>("nombre_material");
    nombre.value = "Plancha";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar el material nuevo?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    fillRequired();
    await act(async () => field("nombre_material").dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => form().requestSubmit());

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("con error el panel sigue abierto con lo escrito y el foco en el campo invalido", async () => {
    await renderInPanel((values) => ({
      status: "error",
      error: "Ya existe un material con ese nombre.",
      fieldErrors: { nombre_material: ["Ya existe un material con ese nombre."] },
      values,
      operationId: "op-10",
    }));
    fillRequired();

    await act(async () => form().requestSubmit());

    expect(navigation.back).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(field<HTMLInputElement>("nombre_material").value).toBe("Plancha LAC 1/16");
    expect(document.activeElement?.id).toBe("nombre_material");
  });
});
