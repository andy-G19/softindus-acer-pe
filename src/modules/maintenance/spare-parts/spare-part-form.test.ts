// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import type { SparePartFormState, SparePartFormValues } from "@/modules/maintenance/spare-parts/actions";
import { SparePartForm } from "@/modules/maintenance/spare-parts/spare-part-form";

// Formulario de repuestos con React real (entrega 10.5a), con el patron de
// Maquinas y Productos: la accion devuelve un resultado en lugar de redirigir,
// y el formulario decide. Con error conserva lo escrito, enfoca el primer
// campo invalido y muestra el error dentro sin un segundo aviso (antes daba
// ademas un toast de error y React vaciaba los campos); con exito da un solo
// aviso y vuelve al returnTo que valido la pagina. El alta rapida de proveedor
// (D3) deja su error en su recuadro y su exito en el proveedor elegido, sin
// toasts.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn(), showSuccess: vi.fn() }));
const suppliers = vi.hoisted(() => ({ createQuickSupplierAction: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/maintenance/spare-parts/new",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/notifications", () => notifications);
vi.mock("@/modules/inventory/suppliers/actions", () => suppliers);

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
  for (const fn of [...Object.values(navigation), ...Object.values(notifications), suppliers.createQuickSupplierAction]) {
    fn.mockReset();
  }
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const LIST = "/dashboard/maintenance/spare-parts";
const PROVIDERS = [
  { id: "PVE00000001", label: "Aceros Arequipa" },
  { id: "PVE00000003", label: "Rodamientos del Sur" },
];
const SUPPLIER_TYPES = [{ slug: "ferreteria", nombre: "Ferretería" }];

function field<T extends HTMLElement>(id: string) {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`No hay campo ${id}`);
  }
  return element;
}

const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;
const selectedProvider = () => document.querySelector<HTMLInputElement>('input[name="id_proveedor"]')!.value;

// Escribe en un campo controlado por React: el valor pasa por el setter nativo
// para que React vea el cambio en el evento input.
async function typeInto(element: HTMLInputElement, text: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

  await act(async () => {
    setValue.call(element, text);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function valuesOf(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as SparePartFormValues;
}

type Respond = (values: SparePartFormValues) => SparePartFormState;

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: SparePartFormState, formData: FormData) => respond(valuesOf(formData)));

  return {
    action,
    props: {
      action,
      providers: PROVIDERS,
      supplierTypes: SUPPLIER_TYPES,
      defaultValues: { estado: "true" },
      submitLabel: "Registrar repuesto",
      successNotification: maintenanceNotifications["spare-part-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(SparePartForm, props)));

  return action;
}

// Los obligatorios: sin ellos, requestSubmit no envia (validacion nativa).
function fillRequired() {
  field<HTMLInputElement>("nombre_repuesto").value = "Faja en V B-52";
  field<HTMLInputElement>("costo_unitario").value = "38.50";
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

const success: Respond = (values) => ({
  status: "success",
  data: { id_repuesto: "REP00000010" },
  values,
  operationId: "op-ok",
});

describe("SparePartForm", () => {
  it("con error conserva lo escrito y el proveedor, enfoca el campo invalido y no da ningun otro aviso", async () => {
    await renderForm(
      (values) => ({
        status: "error",
        error: "Ya existe un repuesto registrado con ese nombre.",
        fieldErrors: { nombre_repuesto: ["Ya existe un repuesto registrado con ese nombre."] },
        values,
        operationId: "op-1",
      }),
      { defaultValues: { estado: "true", id_proveedor: "PVE00000003" } },
    );
    fillRequired();
    field<HTMLSelectElement>("estado").value = "false";
    field<HTMLTextAreaElement>("descripcion").value = "Para la cizalla";

    await submit();

    expect(field<HTMLInputElement>("nombre_repuesto").value).toBe("Faja en V B-52");
    expect(field<HTMLInputElement>("costo_unitario").value).toBe("38.50");
    expect(field<HTMLSelectElement>("estado").value).toBe("false");
    expect(field<HTMLTextAreaElement>("descripcion").value).toBe("Para la cizalla");
    expect(selectedProvider()).toBe("PVE00000003");
    expect(document.activeElement).toBe(field("nombre_repuesto"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Ya existe un repuesto registrado con ese nombre.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("un error del proveedor queda bajo su campo y lo enfoca", async () => {
    await renderForm(
      (values) => ({
        status: "error",
        error: "El proveedor seleccionado no existe o esta inactivo.",
        fieldErrors: { id_proveedor: ["El proveedor seleccionado no existe o esta inactivo."] },
        values,
        operationId: "op-2",
      }),
      { defaultValues: { estado: "true", id_proveedor: "PVE00000001" } },
    );
    fillRequired();

    await submit();

    expect(document.activeElement?.id).toBe("id_proveedor");
    expect(field("id_proveedor").getAttribute("aria-describedby")).toBe("id_proveedor-error");
    expect(field("id_proveedor-error").textContent).toBe("El proveedor seleccionado no existe o esta inactivo.");
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Repuesto guardado correctamente" });
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que el repuesto puede no aparecer", async () => {
    const returnTo = `${LIST}?status=inactive`;
    await renderForm(success, { returnTo });
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      type: "success",
      message: "Repuesto guardado correctamente",
      description: "Puede no aparecer con los filtros activos del listado.",
    });
    expect(navigation.push).toHaveBeenCalledWith(returnTo);
  });

  it("el alta empieza activo y Volver al listado lleva al returnTo sin enviar", async () => {
    const returnTo = `${LIST}?q=faja`;
    const action = await renderForm(success, { returnTo });
    const back = [...document.querySelectorAll("a")].find((link) => link.textContent === "Volver al listado");

    expect(field<HTMLSelectElement>("estado").value).toBe("true");
    expect(back?.getAttribute("href")).toBe(returnTo);
    expect(action).not.toHaveBeenCalled();
  });

  it("la edicion abre con los datos del repuesto y envia su id", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      successNotification: maintenanceNotifications["spare-part-updated"],
      defaultValues: {
        id_repuesto: "REP00000004",
        id_proveedor: "PVE00000001",
        nombre_repuesto: "Faja en V B-52",
        descripcion: "Para la cizalla",
        costo_unitario: "38.5",
        estado: "false",
      },
    });

    expect(field<HTMLInputElement>("costo_unitario").value).toBe("38.5");
    expect(field<HTMLSelectElement>("estado").value).toBe("false");

    await submit();

    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id_repuesto")).toBe("REP00000004");
    expect(sent.get("id_proveedor")).toBe("PVE00000001");
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Repuesto actualizado correctamente" });
  });
});

describe("SparePartForm · alta rapida de proveedor (D3)", () => {
  async function openQuickSupplier() {
    await renderForm(success);
    await act(async () => button("Registrar proveedor nuevo").click());
    await typeInto(field<HTMLInputElement>("nuevo_proveedor_razon_social"), "Ferreteria El Perno");
  }

  it("con error lo deja en su recuadro, sin toast, y conserva lo escrito", async () => {
    suppliers.createQuickSupplierAction.mockResolvedValue({ ok: false, error: "Selecciona un tipo de proveedor activo." });
    await openQuickSupplier();

    await act(async () => button("Registrar y usar").click());

    expect(document.querySelector('[role="alert"]')?.textContent).toBe("Selecciona un tipo de proveedor activo.");
    expect(field<HTMLInputElement>("nuevo_proveedor_razon_social").value).toBe("Ferreteria El Perno");
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(selectedProvider()).toBe("");
  });

  it("con exito elige el proveedor nuevo, cierra el recuadro y lo dice bajo el campo, sin toast", async () => {
    suppliers.createQuickSupplierAction.mockResolvedValue({
      ok: true,
      supplier: { id: "PVE00000009", label: "Ferreteria El Perno" },
    });
    await openQuickSupplier();

    await act(async () => button("Registrar y usar").click());

    expect(suppliers.createQuickSupplierAction).toHaveBeenCalledWith({
      razon_social: "Ferreteria El Perno",
      tipo_proveedor: "ferreteria",
      telefono: "",
    });
    expect(selectedProvider()).toBe("PVE00000009");
    expect(field<HTMLInputElement>("id_proveedor").value).toBe("Ferreteria El Perno");
    expect(document.querySelector('[role="status"]')?.textContent).toBe(
      "Ferreteria El Perno quedó seleccionado en el repuesto.",
    );
    expect(document.querySelector("#nuevo_proveedor_razon_social")).toBeNull();
    expect(notifications.showSuccess).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

// En el panel lateral (entrega 10.5a): el mismo formulario dentro de un RouteSheet.
describe("SparePartForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { action, props } = formProps(respond, { returnTo: `${LIST}?q=faja` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Registrar repuesto",
          discardTitle: "¿Descartar el repuesto nuevo?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(SparePartForm, props),
        }),
      ),
    );

    return action;
  }

  const form = () => document.querySelector("form")!;

  it("el foco empieza en el primer campo y Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    expect(document.activeElement?.id).toBe("nombre_repuesto");
    expect([...document.querySelectorAll("a")].some((link) => link.textContent === "Volver al listado")).toBe(false);

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const nombre = field<HTMLInputElement>("nombre_repuesto");
    nombre.value = "Faja";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar el repuesto nuevo?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  // Hallazgo 1 de la 10.5a: elegir un proveedor sin escribir no marcaba
  // cambios y Cancelar cerraba el panel sin preguntar.
  it("elegir un proveedor sin escribir tambien cuenta como cambio", async () => {
    await renderInPanel(success);
    await act(async () => field<HTMLInputElement>("id_proveedor").focus());
    const option = [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((item) =>
      item.textContent?.includes("Rodamientos del Sur"),
    )!;
    await act(async () => option.click());

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar el repuesto nuevo?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    fillRequired();
    await act(async () => field("nombre_repuesto").dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => form().requestSubmit());

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("con error el panel sigue abierto con lo escrito y el foco en el campo invalido", async () => {
    await renderInPanel((values) => ({
      status: "error",
      error: "Revisa los datos del repuesto.",
      fieldErrors: { costo_unitario: ["El costo unitario no debe superar S/ 9,999,999,999.99."] },
      values,
      operationId: "op-10",
    }));
    fillRequired();

    await act(async () => form().requestSubmit());

    expect(navigation.back).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(field<HTMLInputElement>("nombre_repuesto").value).toBe("Faja en V B-52");
    expect(document.activeElement?.id).toBe("costo_unitario");
  });
});
