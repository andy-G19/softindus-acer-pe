// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { inventoryNotifications } from "@/modules/inventory/notifications";
import type {
  SupplierMaterialFormState,
  SupplierMaterialFormValues,
} from "@/modules/inventory/supplier-materials/actions";
import { SupplierMaterialForm } from "@/modules/inventory/supplier-materials/supplier-material-form";

// Formulario de asociaciones proveedor-material con React real (entrega
// 10.3b), con el patron de Clientes, Materiales y Proveedores: la accion
// devuelve un resultado en lugar de redirigir, y el formulario decide. Con
// error conserva lo escrito, enfoca el primer campo invalido y muestra el
// error dentro sin un segundo aviso (antes daba ademas un toast de error); con
// exito da un solo aviso y vuelve al returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/inventory/supplier-materials/new",
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

const LIST = "/dashboard/inventory/supplier-materials";
const SUPPLIERS = [
  { id: "PVE00000004", label: "Aceros del Sur S.A.C." },
  { id: "PVE00000002", label: "Ferretería El Perno" },
];
const MATERIALS = [
  { id: "MAT00000004", label: "Plancha LAC 1/16 (unidad)" },
  { id: "MAT00000002", label: "Soldadura E6011 (kg)" },
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
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as SupplierMaterialFormValues;
}

type Respond = (values: SupplierMaterialFormValues) => SupplierMaterialFormState;

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: SupplierMaterialFormState, formData: FormData) => respond(valuesOf(formData)));

  return {
    action,
    props: {
      action,
      suppliers: SUPPLIERS,
      materials: MATERIALS,
      submitLabel: "Guardar asociación",
      successNotification: inventoryNotifications["supplier-material-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(SupplierMaterialForm, props)));

  return action;
}

// Los campos obligatorios: sin ellos, requestSubmit no envia (validacion nativa).
function fillRequired() {
  field<HTMLSelectElement>("id_proveedor").value = "PVE00000004";
  field<HTMLSelectElement>("id_material").value = "MAT00000004";
  field<HTMLInputElement>("unidad_medida").value = "plancha";
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

const success: Respond = (values) => ({
  status: "success",
  data: { id_proveedor_material: "PVM00000008" },
  values,
  operationId: "op-ok",
});

describe("SupplierMaterialForm", () => {
  it("con error conserva lo escrito, enfoca el campo invalido y no da ningun otro aviso", async () => {
    await renderForm((values) => ({
      status: "error",
      error: "Este proveedor ya está asociado con el material seleccionado.",
      fieldErrors: { id_material: ["Este proveedor ya está asociado con el material seleccionado."] },
      values,
      operationId: "op-1",
    }));
    fillRequired();
    field<HTMLInputElement>("precio_referencial").value = "185.50";
    field<HTMLSelectElement>("disponibilidad").value = "media";

    await submit();

    expect(field<HTMLSelectElement>("id_proveedor").value).toBe("PVE00000004");
    expect(field<HTMLSelectElement>("id_material").value).toBe("MAT00000004");
    expect(field<HTMLInputElement>("precio_referencial").value).toBe("185.50");
    expect(field<HTMLSelectElement>("disponibilidad").value).toBe("media");
    expect(document.activeElement).toBe(field("id_material"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Este proveedor ya está asociado con el material seleccionado.");
    expect(field("id_material-error").textContent).toBe("Este proveedor ya está asociado con el material seleccionado.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Asociación proveedor-material creada" });
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que la asociacion puede no aparecer", async () => {
    const returnTo = `${LIST}?status=inactive`;
    await renderForm(success, { returnTo });
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      type: "success",
      message: "Asociación proveedor-material creada",
      description: "Puede no aparecer con los filtros activos del listado.",
    });
    expect(navigation.push).toHaveBeenCalledWith(returnTo);
  });

  it("Cancelar vuelve al returnTo sin enviar", async () => {
    const returnTo = `${LIST}?supplier=PVE00000004`;
    const action = await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(cancel?.getAttribute("href")).toBe(returnTo);
    expect(action).not.toHaveBeenCalled();
  });

  it("la edicion abre con los datos de la asociacion y envia su id", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      successNotification: inventoryNotifications["supplier-material-updated"],
      defaultValues: {
        id_proveedor_material: "PVM00000004",
        id_proveedor: "PVE00000002",
        id_material: "MAT00000002",
        unidad_medida: "kg",
        precio_referencial: "12.5",
        tiempo_entrega_dias: "3",
        disponibilidad: "baja",
      },
    });

    expect(field<HTMLSelectElement>("id_proveedor").value).toBe("PVE00000002");
    expect(field<HTMLSelectElement>("disponibilidad").value).toBe("baja");

    await submit();

    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id_proveedor_material")).toBe("PVM00000004");
    expect(sent.get("tiempo_entrega_dias")).toBe("3");
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Asociación proveedor-material actualizada" });
  });

  it("sin proveedores o materiales activos avisa y no deja guardar", async () => {
    await renderForm(success, { suppliers: [] });

    expect(host.textContent).toContain("Deben existir proveedores y materiales activos para crear asociaciones.");
    expect(field<HTMLSelectElement>("id_proveedor").disabled).toBe(true);
    expect(field<HTMLSelectElement>("id_material").disabled).toBe(false);
    expect(submitButton().disabled).toBe(true);
  });
});

// En el panel lateral (entrega 10.3b): el mismo formulario dentro de un RouteSheet.
describe("SupplierMaterialForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { action, props } = formProps(respond, { returnTo: `${LIST}?status=active` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nueva asociación proveedor-material",
          discardTitle: "¿Descartar la asociación nueva?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(SupplierMaterialForm, props),
        }),
      ),
    );

    return action;
  }

  const form = () => document.querySelector("form")!;

  it("el foco empieza en el primer campo y Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    expect(document.activeElement?.id).toBe("id_proveedor");
    expect([...document.querySelectorAll("a")].some((link) => link.textContent === "Cancelar")).toBe(false);

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const unidad = field<HTMLInputElement>("unidad_medida");
    unidad.value = "kg";
    await act(async () => unidad.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la asociación nueva?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    fillRequired();
    await act(async () => field("unidad_medida").dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => form().requestSubmit());

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("con error el panel sigue abierto con lo escrito y el foco en el campo invalido", async () => {
    await renderInPanel((values) => ({
      status: "error",
      error: "El proveedor seleccionado no existe o está inactivo.",
      fieldErrors: { id_proveedor: ["El proveedor seleccionado no existe o está inactivo."] },
      values,
      operationId: "op-10",
    }));
    fillRequired();

    await act(async () => form().requestSubmit());

    expect(navigation.back).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(field<HTMLInputElement>("unidad_medida").value).toBe("plancha");
    expect(document.activeElement?.id).toBe("id_proveedor");
  });
});
