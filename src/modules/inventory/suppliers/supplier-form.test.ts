// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import type { SupplierFormState, SupplierFormValues } from "@/modules/inventory/suppliers/actions";
import { SupplierForm } from "@/modules/inventory/suppliers/supplier-form";

// Formulario de proveedores con React real (entrega 10.3b), con el patron de
// Clientes y Materiales: la accion devuelve un resultado en lugar de
// redirigir, y el formulario decide. Con error conserva lo escrito, enfoca el
// primer campo invalido y muestra el error dentro sin un segundo aviso (antes
// daba ademas un toast de error); con exito da un solo aviso y vuelve al
// returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/inventory/suppliers/new",
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

const LIST = "/dashboard/inventory/suppliers";
const SUPPLIER_TYPES = [
  { slug: "distribuidor", nombre: "Distribuidor" },
  { slug: "ferreteria", nombre: "Ferretería" },
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
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as SupplierFormValues;
}

type Respond = (values: SupplierFormValues) => SupplierFormState;

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: SupplierFormState, formData: FormData) => respond(valuesOf(formData)));

  return {
    action,
    props: {
      action,
      supplierTypes: SUPPLIER_TYPES,
      submitLabel: "Guardar proveedor",
      successNotification: inventoryNotifications["supplier-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(SupplierForm, props)));

  return action;
}

// Los campos obligatorios: sin ellos, requestSubmit no envia (validacion nativa).
function fillRequired() {
  field<HTMLInputElement>("razon_social").value = "Aceros del Sur S.A.C.";
  field<HTMLSelectElement>("tipo_proveedor").value = "distribuidor";
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

const success: Respond = (values) => ({
  status: "success",
  data: { id_proveedor: "PVE00000008" },
  values,
  operationId: "op-ok",
});

describe("SupplierForm", () => {
  it("con error conserva lo escrito, enfoca el campo invalido y no da ningun otro aviso", async () => {
    await renderForm((values) => ({
      status: "error",
      error: "Ya existe un proveedor con ese número de documento.",
      fieldErrors: { numero_documento: ["Ya existe un proveedor con ese número de documento."] },
      values,
      operationId: "op-1",
    }));
    fillRequired();
    field<HTMLSelectElement>("tipo_documento").value = "ruc";
    field<HTMLInputElement>("numero_documento").value = "20601234567";
    field<HTMLSelectElement>("condicion_pago").value = "credito";

    await submit();

    expect(field<HTMLInputElement>("razon_social").value).toBe("Aceros del Sur S.A.C.");
    expect(field<HTMLSelectElement>("tipo_proveedor").value).toBe("distribuidor");
    expect(field<HTMLSelectElement>("tipo_documento").value).toBe("ruc");
    expect(field<HTMLSelectElement>("condicion_pago").value).toBe("credito");
    expect(document.activeElement).toBe(field("numero_documento"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Ya existe un proveedor con ese número de documento.");
    expect(field("numero_documento-error").textContent).toBe("Ya existe un proveedor con ese número de documento.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    const returnTo = LIST;
    await renderForm(success, { returnTo });
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Proveedor guardado correctamente" });
    expect(navigation.push).toHaveBeenCalledWith(returnTo);
  });

  it("si el listado tiene filtros, el aviso explica que el proveedor puede no aparecer", async () => {
    const returnTo = `${LIST}?status=inactive`;
    await renderForm(success, { returnTo });
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      type: "success",
      message: "Proveedor guardado correctamente",
      description: "Puede no aparecer con los filtros activos del listado.",
    });
    expect(navigation.push).toHaveBeenCalledWith(returnTo);
  });

  it("Cancelar vuelve al returnTo sin enviar", async () => {
    const returnTo = `${LIST}?q=acero`;
    const action = await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(cancel?.getAttribute("href")).toBe(returnTo);
    expect(action).not.toHaveBeenCalled();
  });

  it("la edicion abre con los datos del proveedor y envia su id", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      successNotification: inventoryNotifications["supplier-updated"],
      defaultValues: {
        id_proveedor: "PVE00000004",
        razon_social: "Aceros del Sur S.A.C.",
        tipo_documento: "ruc",
        numero_documento: "20601234567",
        telefono: "999 888 777",
        correo: "ventas@acerosdelsur.pe",
        direccion: "Av. Industrial 123",
        contacto_principal: "Rosa Quispe",
        tipo_proveedor: "ferreteria",
        condicion_pago: "contado",
        observaciones: "Entrega en planta",
      },
    });

    expect(field<HTMLSelectElement>("tipo_proveedor").value).toBe("ferreteria");
    expect(field<HTMLTextAreaElement>("observaciones").value).toBe("Entrega en planta");

    await submit();

    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id_proveedor")).toBe("PVE00000004");
    expect(sent.get("condicion_pago")).toBe("contado");
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Proveedor actualizado correctamente" });
  });

  it("sin tipos de proveedor activos avisa con el enlace y no deja guardar", async () => {
    await renderForm(success, { supplierTypes: [] });

    expect(host.textContent).toContain("No hay tipos de proveedor activos.");
    expect(document.querySelector('a[href="/dashboard/inventory/supplier-types"]')).not.toBeNull();
    expect(field<HTMLSelectElement>("tipo_proveedor").disabled).toBe(true);
    expect(submitButton().disabled).toBe(true);
  });
});

// En el panel lateral (entrega 10.3b): el mismo formulario dentro de un RouteSheet.
describe("SupplierForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { action, props } = formProps(respond, { returnTo: `${LIST}?q=acero` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nuevo proveedor",
          discardTitle: "¿Descartar el proveedor nuevo?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(SupplierForm, props),
        }),
      ),
    );

    return action;
  }

  const form = () => document.querySelector("form")!;

  it("el foco empieza en el primer campo y Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    expect(document.activeElement?.id).toBe("razon_social");
    expect([...document.querySelectorAll("a")].some((link) => link.textContent === "Cancelar")).toBe(false);

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const razonSocial = field<HTMLInputElement>("razon_social");
    razonSocial.value = "Aceros";
    await act(async () => razonSocial.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar el proveedor nuevo?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    fillRequired();
    await act(async () => field("razon_social").dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => form().requestSubmit());

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("con error el panel sigue abierto con lo escrito y el foco en el campo invalido", async () => {
    await renderInPanel((values) => ({
      status: "error",
      error: "Selecciona un tipo de proveedor activo.",
      fieldErrors: { tipo_proveedor: ["Selecciona un tipo de proveedor activo."] },
      values,
      operationId: "op-10",
    }));
    fillRequired();

    await act(async () => form().requestSubmit());

    expect(navigation.back).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(field<HTMLInputElement>("razon_social").value).toBe("Aceros del Sur S.A.C.");
    expect(document.activeElement?.id).toBe("tipo_proveedor");
  });
});
