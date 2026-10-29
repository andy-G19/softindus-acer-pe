// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import type { MachineFormState, MachineFormValues } from "@/modules/maintenance/machines/actions";
import { MachineForm } from "@/modules/maintenance/machines/machine-form";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";

// Formulario de maquinas con React real (entrega 10.5a), con el patron de
// Productos y Proveedores: la accion devuelve un resultado en lugar de
// redirigir, y el formulario decide. Con error conserva lo escrito, enfoca el
// primer campo invalido y muestra el error dentro sin un segundo aviso (antes
// daba ademas un toast de error y React vaciaba los campos); con exito da un
// solo aviso y vuelve al returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/maintenance/machines/new",
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

const LIST = "/dashboard/maintenance/machines";

function field<T extends HTMLElement>(id: string) {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`No hay campo ${id}`);
  }
  return element;
}

const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;

function valuesOf(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as MachineFormValues;
}

type Respond = (values: MachineFormValues) => MachineFormState;

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: MachineFormState, formData: FormData) => respond(valuesOf(formData)));

  return {
    action,
    props: {
      action,
      defaultValues: { tipo: "prensa", estado: "operativa" },
      submitLabel: "Registrar maquina",
      successNotification: maintenanceNotifications["machine-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(MachineForm, props)));

  return action;
}

// El nombre es el unico obligatorio sin valor inicial: sin el, requestSubmit
// no envia (validacion nativa).
function fillRequired() {
  field<HTMLInputElement>("nombre").value = "Prensa hidráulica 60 t";
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

const success: Respond = (values) => ({
  status: "success",
  data: { id_maquina: "MAQ00000010" },
  values,
  operationId: "op-ok",
});

describe("MachineForm", () => {
  it("con error conserva lo escrito, enfoca el campo invalido y no da ningun otro aviso", async () => {
    await renderForm((values) => ({
      status: "error",
      error: "Ya existe una maquina registrada con ese nombre, tipo o codigo interno.",
      fieldErrors: { nombre: ["Ya existe una maquina registrada con ese nombre, tipo o codigo interno."] },
      values,
      operationId: "op-1",
    }));
    fillRequired();
    field<HTMLSelectElement>("tipo").value = "soldadora";
    field<HTMLInputElement>("codigo_interno").value = "SO-02";
    field<HTMLInputElement>("ubicacion").value = "Nave 2";
    field<HTMLSelectElement>("estado").value = "en_reparacion";
    field<HTMLTextAreaElement>("observaciones").value = "Cambiar antorcha";

    await submit();

    expect(field<HTMLInputElement>("nombre").value).toBe("Prensa hidráulica 60 t");
    expect(field<HTMLSelectElement>("tipo").value).toBe("soldadora");
    expect(field<HTMLInputElement>("codigo_interno").value).toBe("SO-02");
    expect(field<HTMLInputElement>("ubicacion").value).toBe("Nave 2");
    expect(field<HTMLSelectElement>("estado").value).toBe("en_reparacion");
    expect(field<HTMLTextAreaElement>("observaciones").value).toBe("Cambiar antorcha");
    expect(document.activeElement).toBe(field("nombre"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      "Ya existe una maquina registrada con ese nombre, tipo o codigo interno.",
    );
    expect(field("nombre-error").textContent).toBe("Ya existe una maquina registrada con ese nombre, tipo o codigo interno.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Máquina guardada correctamente" });
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que la maquina puede no aparecer", async () => {
    const returnTo = `${LIST}?status=inactiva`;
    await renderForm(success, { returnTo });
    fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      type: "success",
      message: "Máquina guardada correctamente",
      description: "Puede no aparecer con los filtros activos del listado.",
    });
    expect(navigation.push).toHaveBeenCalledWith(returnTo);
  });

  it("el alta empieza con prensa y operativa, y Cancelar vuelve al returnTo sin enviar", async () => {
    const returnTo = `${LIST}?q=prensa`;
    const action = await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(field<HTMLSelectElement>("tipo").value).toBe("prensa");
    expect(field<HTMLSelectElement>("estado").value).toBe("operativa");
    expect(cancel?.getAttribute("href")).toBe(returnTo);
    expect(action).not.toHaveBeenCalled();
  });

  it("la edicion abre con los datos de la maquina y envia su id", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      successNotification: maintenanceNotifications["machine-updated"],
      defaultValues: {
        id_maquina: "MAQ00000004",
        nombre: "Esmeril de banco",
        tipo: "esmeril",
        codigo_interno: "ES-01",
        ubicacion: "Nave 1",
        estado: "dada_de_baja",
        observaciones: "Sin disco",
      },
    });

    expect(field<HTMLSelectElement>("tipo").value).toBe("esmeril");
    expect(field<HTMLSelectElement>("estado").value).toBe("dada_de_baja");
    expect(field<HTMLTextAreaElement>("observaciones").value).toBe("Sin disco");

    await submit();

    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id_maquina")).toBe("MAQ00000004");
    expect(sent.get("estado")).toBe("dada_de_baja");
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Máquina actualizada correctamente" });
  });
});

// En el panel lateral (entrega 10.5a): el mismo formulario dentro de un RouteSheet.
describe("MachineForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { action, props } = formProps(respond, { returnTo: `${LIST}?q=prensa` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Registrar máquina",
          discardTitle: "¿Descartar la máquina nueva?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(MachineForm, props),
        }),
      ),
    );

    return action;
  }

  const form = () => document.querySelector("form")!;

  it("el foco empieza en el primer campo y Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    expect(document.activeElement?.id).toBe("nombre");
    expect([...document.querySelectorAll("a")].some((link) => link.textContent === "Cancelar")).toBe(false);

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const nombre = field<HTMLInputElement>("nombre");
    nombre.value = "Prensa";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la máquina nueva?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    fillRequired();
    await act(async () => field("nombre").dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => form().requestSubmit());

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("con error el panel sigue abierto con lo escrito y el foco en el campo invalido", async () => {
    await renderInPanel((values) => ({
      status: "error",
      error: "Revisa los datos de la maquina.",
      fieldErrors: { estado: ["Seleccione un estado válido para la máquina."] },
      values,
      operationId: "op-10",
    }));
    fillRequired();

    await act(async () => form().requestSubmit());

    expect(navigation.back).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(field<HTMLInputElement>("nombre").value).toBe("Prensa hidráulica 60 t");
    expect(document.activeElement?.id).toBe("estado");
  });
});
