// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { productionNotifications } from "@/modules/production/notifications";
import type { RouteStageFormState } from "@/modules/production/stages/actions";
import { StageForm } from "@/modules/production/stages/stage-form";

// Formulario de etapas con React real (entrega 10.6a). La accion devuelve un
// resultado y no redirige. Con error se conservan lo escrito y los campos que son
// estado del formulario (maquina, tiempos, modo), porque ActionForm remonta los
// demas; el mensaje queda dentro, sin el toast que antes lo duplicaba. La vista
// previa sigue a esos campos, y al quitar la maquina su tiempo no queda colgado.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/production/routes/RUT00000003/stages/new",
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

const ROUTE = "RUT00000003";
const LIST = `/dashboard/production/routes/${ROUTE}/stages`;
const MACHINES = [
  { id_maquina: "MAQ00000002", nombre: "Plegadora", tipo: "prensa", estado: "operativa" },
  { id_maquina: "MAQ00000003", nombre: "Soldadora", tipo: "soldadora", estado: "en_reparacion" },
];
const WITH_MACHINE = {
  nombre_etapa: "Corte",
  orden_secuencia: "2",
  tiempo_operario_minutos_unidad: "8",
  id_maquina: "MAQ00000002",
  tiempo_maquina_minutos_unidad: "6",
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
const requiresMachine = () => document.querySelector<HTMLInputElement>('input[name="requiere_maquina"]')!;

type Respond = (formData: FormData) => RouteStageFormState;

const valuesOf = (formData: FormData) => ({
  nombre_etapa: String(formData.get("nombre_etapa") ?? ""),
  orden_secuencia: String(formData.get("orden_secuencia") ?? ""),
  descripcion: String(formData.get("descripcion") ?? ""),
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_etapa_ruta: "ETA00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: RouteStageFormState, formData: FormData) => respond(formData));

  return {
    action,
    props: {
      action,
      routeId: ROUTE,
      machines: MACHINES,
      submitLabel: "Registrar etapa",
      successNotification: productionNotifications["route-stage-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(StageForm, props)));

  return action;
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

// Cambia un control de React como lo haria el navegador.
async function setValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

describe("StageForm", () => {
  it("con error conserva lo escrito y la maquina, enfoca el campo y no da ningun aviso", async () => {
    const message = "Ya existe una etapa con ese número de orden en esta ruta.";
    await renderForm(
      (formData) => ({
        status: "error",
        error: message,
        fieldErrors: { orden_secuencia: [message] },
        values: valuesOf(formData),
        operationId: "op-1",
      }),
      { defaultValues: WITH_MACHINE },
    );
    field<HTMLInputElement>("nombre_etapa").value = "Corte fino";
    field<HTMLTextAreaElement>("descripcion").value = "Con disco nuevo";

    await submit();

    expect(field<HTMLInputElement>("nombre_etapa").value).toBe("Corte fino");
    expect(field<HTMLTextAreaElement>("descripcion").value).toBe("Con disco nuevo");
    expect(field<HTMLSelectElement>("id_maquina").value).toBe("MAQ00000002");
    expect(field<HTMLInputElement>("tiempo_maquina_minutos_unidad").value).toBe("6");
    expect(document.activeElement).toBe(field("orden_secuencia"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(field("orden_secuencia-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success, { defaultValues: WITH_MACHINE });

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(productionNotifications["route-stage-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que la etapa puede no aparecer", async () => {
    await renderForm(success, { returnTo: `${LIST}?q=corte`, defaultValues: WITH_MACHINE });

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...productionNotifications["route-stage-created"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
  });

  it("Cancelar es un enlace al returnTo", async () => {
    const returnTo = `${LIST}?status=active`;
    await renderForm(success, { returnTo });

    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(cancel?.getAttribute("href")).toBe(returnTo);
  });

  it("envia la ruta, el id al editar y el modo de tiempo", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      defaultValues: { ...WITH_MACHINE, id_etapa_ruta: "ETA00000006", modo_tiempo: "secuencial" },
    });

    await submit();

    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id_ruta")).toBe(ROUTE);
    expect(sent.get("id_etapa_ruta")).toBe("ETA00000006");
    expect(sent.get("modo_tiempo")).toBe("secuencial");
  });

  it("elegir una maquina pide sus minutos y marca que la requiere", async () => {
    await renderForm(success);

    expect(document.querySelector("#tiempo_maquina_minutos_unidad")).toBeNull();

    await setValue(field<HTMLSelectElement>("id_maquina"), "MAQ00000003");

    expect(field("tiempo_maquina_minutos_unidad")).not.toBeNull();
    expect(requiresMachine().checked).toBe(true);
    expect(requiresMachine().disabled).toBe(true);
  });

  it("quitar la maquina borra su tiempo", async () => {
    await renderForm(success, { defaultValues: WITH_MACHINE });

    await setValue(field<HTMLSelectElement>("id_maquina"), "");
    expect(document.querySelector("#tiempo_maquina_minutos_unidad")).toBeNull();

    await setValue(field<HTMLSelectElement>("id_maquina"), "MAQ00000002");
    expect(field<HTMLInputElement>("tiempo_maquina_minutos_unidad").value).toBe("");
  });

  it("la vista previa sigue a los tiempos y al modo", async () => {
    await renderForm(success, { defaultValues: WITH_MACHINE });

    expect(host.textContent).toContain("Duración de la etapa: 80.00 min");

    await act(async () => field("modo_tiempo_switch").click());

    expect(host.textContent).toContain("Modo: secuencial");
    expect(host.textContent).toContain("Duración de la etapa: 140.00 min");
    expect(hidden("modo_tiempo")?.value).toBe("secuencial");

    await setValue(field<HTMLInputElement>("tiempo_operario_minutos_unidad"), "10");

    expect(host.textContent).toContain("Duración de la etapa: 160.00 min");
  });

  it("los avisos de la pagina van dentro del formulario", async () => {
    await renderForm(success, { notices: h("p", { id: "aviso" }, "Aviso de prueba") });

    expect(document.querySelector("form #aviso")?.textContent).toBe("Aviso de prueba");
  });

  it("deshabilitado no deja escribir ni guardar", async () => {
    await renderForm(success, { disabled: true });

    expect(field<HTMLInputElement>("nombre_etapa").disabled).toBe(true);
    expect(field<HTMLSelectElement>("id_maquina").disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it("sin maquinas explica de donde agregarlas", async () => {
    await renderForm(success, { machines: [] });

    expect(host.textContent).toContain("No hay máquinas registradas.");
  });
});

describe("StageForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond, overrides: Record<string, unknown> = {}) {
    const { props } = formProps(respond, { returnTo: `${LIST}?q=corte`, defaultValues: WITH_MACHINE, ...overrides });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nueva etapa de ruta",
          discardTitle: "¿Descartar la etapa nueva?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(StageForm, props),
        }),
      ),
    );
  }

  it("deshabilitado no deja guardar", async () => {
    await renderInPanel(success, { disabled: true });

    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it("Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    expect([...document.querySelectorAll("a")].some((link) => link.textContent === "Cancelar")).toBe(false);

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("cambiar la maquina cuenta como cambio y Cancelar pide confirmar", async () => {
    await renderInPanel(success);
    await setValue(field<HTMLSelectElement>("id_maquina"), "MAQ00000003");
    await act(async () => field("id_maquina").dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la etapa nueva?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("el interruptor del modo cuenta como cambio", async () => {
    await renderInPanel(success);

    await act(async () => field("modo_tiempo_switch").click());
    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la etapa nueva?");
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await act(async () => field("nombre_etapa").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
