// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { productionNotifications } from "@/modules/production/notifications";
import type { FabricationRouteFormState } from "@/modules/production/routes/actions";
import { RouteForm } from "@/modules/production/routes/route-form";

// Formulario de rutas con React real (entrega 10.6a). La accion devuelve un
// resultado en lugar de lanzar: con error se conserva lo escrito, tambien el
// producto elegido, y el mensaje queda dentro del formulario; con exito hay un
// solo aviso y se vuelve al returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/production/routes/new",
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

const LIST = "/dashboard/production/routes";
const PRODUCTS = [
  { id: "PRO00000001", label: "Lampa", description: "herramientas - unidad" },
  { id: "PRO00000002", label: "Pico", description: "herramientas - unidad" },
];
const EDIT_VALUES = {
  id_ruta: "RUT00000003",
  id_producto: "PRO00000002",
  nombre_ruta: "Ruta del pico",
  descripcion: "Forja y temple",
};

function field<T extends HTMLElement>(id: string) {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`No hay campo ${id}`);
  }
  return element;
}

const hidden = (name: string) => document.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;

type Respond = (formData: FormData) => FabricationRouteFormState;

const valuesOf = (formData: FormData) => ({
  id_producto: String(formData.get("id_producto")),
  nombre_ruta: String(formData.get("nombre_ruta")),
  descripcion: String(formData.get("descripcion")),
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_ruta: "RUT00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: FabricationRouteFormState, formData: FormData) => respond(formData));

  return {
    action,
    props: {
      action,
      products: PRODUCTS,
      submitLabel: "Guardar ruta",
      successNotification: productionNotifications["route-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(RouteForm, props)));

  return action;
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

describe("RouteForm", () => {
  it("con error conserva lo escrito y el producto, enfoca el campo y no da otro aviso", async () => {
    const message = "Ya existe una ruta con ese nombre para este producto.";
    await renderForm(
      (formData) => ({
        status: "error",
        error: message,
        fieldErrors: { nombre_ruta: [message] },
        values: valuesOf(formData),
        operationId: "op-1",
      }),
      { defaultValues: { ...EDIT_VALUES, id_ruta: undefined } },
    );
    field<HTMLInputElement>("nombre_ruta").value = "Ruta nueva";
    field<HTMLTextAreaElement>("descripcion").value = "Corte y pintura";

    await submit();

    expect(field<HTMLInputElement>("nombre_ruta").value).toBe("Ruta nueva");
    expect(field<HTMLTextAreaElement>("descripcion").value).toBe("Corte y pintura");
    expect(hidden("id_producto")?.value).toBe("PRO00000002");
    expect(field<HTMLInputElement>("id_producto").value).toBe("Pico");
    expect(document.activeElement).toBe(field("nombre_ruta"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(field("nombre_ruta-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("un error del producto enfoca el selector", async () => {
    const message = "El producto seleccionado no existe o está inactivo.";
    await renderForm(
      (formData) => ({
        status: "error",
        error: message,
        fieldErrors: { id_producto: [message] },
        values: valuesOf(formData),
        operationId: "op-2",
      }),
      { defaultValues: { id_producto: "PRO00000001", nombre_ruta: "Ruta de lampa" } },
    );

    await submit();

    expect(field("id_producto").getAttribute("aria-invalid")).toBe("true");
    expect(field("id_producto-error").textContent).toBe(message);
    expect(document.activeElement).toBe(field("id_producto"));
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success, { defaultValues: { id_producto: "PRO00000001", nombre_ruta: "Ruta de lampa" } });

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(productionNotifications["route-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que la ruta puede no aparecer", async () => {
    const returnTo = `${LIST}?status=inactive`;
    await renderForm(success, { returnTo, defaultValues: { id_producto: "PRO00000001", nombre_ruta: "Ruta de lampa" } });

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...productionNotifications["route-created"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
  });

  it("el alta explica que las etapas van despues y Cancelar es un enlace al returnTo", async () => {
    const returnTo = `${LIST}?q=lampa`;
    await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(host.textContent).toContain("En esta pantalla solo registramos la ruta general.");
    expect(cancel?.getAttribute("href")).toBe(returnTo);
  });

  it("sin productos activos avisa y no deja guardar", async () => {
    await renderForm(success, { products: [] });

    expect(host.textContent).toContain("No hay productos activos registrados.");
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it("la edicion abre con los datos de la ruta y envia su id", async () => {
    const action = await renderForm(success, { submitLabel: "Guardar cambios", defaultValues: EDIT_VALUES });

    expect(host.textContent).not.toContain("En esta pantalla solo registramos la ruta general.");
    expect(field<HTMLInputElement>("nombre_ruta").value).toBe("Ruta del pico");
    expect(field<HTMLTextAreaElement>("descripcion").value).toBe("Forja y temple");

    await submit();

    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id_ruta")).toBe("RUT00000003");
    expect(sent.get("id_producto")).toBe("PRO00000002");
  });

  it("con ordenes el producto se ve bloqueado y se envia igual", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      defaultValues: EDIT_VALUES,
      lockedProductName: "Pico",
    });

    expect(field<HTMLInputElement>("producto_bloqueado").value).toBe("Pico");
    expect(field<HTMLInputElement>("producto_bloqueado").readOnly).toBe(true);
    expect(document.querySelector('[role="combobox"]')).toBeNull();
    expect(host.textContent).toContain("Esta ruta tiene órdenes asociadas");

    await submit();

    expect((action.mock.calls[0]?.[1] as FormData).get("id_producto")).toBe("PRO00000002");
  });
});

describe("RouteForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { props } = formProps(respond, {
      returnTo: `${LIST}?q=lampa`,
      defaultValues: { id_producto: "PRO00000001", nombre_ruta: "Ruta de lampa" },
    });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nueva ruta de fabricación",
          discardTitle: "¿Descartar la ruta nueva?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(RouteForm, props),
        }),
      ),
    );
  }

  it("Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    expect([...document.querySelectorAll("a")].some((link) => link.textContent === "Cancelar")).toBe(false);

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const nombre = field<HTMLInputElement>("nombre_ruta");
    nombre.value = "Otra";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la ruta nueva?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await act(async () => field("nombre_ruta").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
