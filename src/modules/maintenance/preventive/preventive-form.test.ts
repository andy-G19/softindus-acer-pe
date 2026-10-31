// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import type { PreventiveFormState, PreventiveFormValues } from "@/modules/maintenance/preventive/actions";
import { PreventiveForm } from "@/modules/maintenance/preventive/preventive-form";

// Formulario de preventivos con React real (entrega 10.5b), con el patron de
// Fallas: la accion devuelve un resultado en lugar de redirigir o lanzar, y el
// formulario decide. Con error conserva lo escrito y la maquina elegida, enfoca
// el primer campo invalido y muestra el error dentro, sin otro aviso (antes
// llevaba a la pagina de error y se perdia lo escrito); con exito da un solo
// aviso, con la nota si el listado tiene filtros, y vuelve al returnTo.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/maintenance/preventive/new",
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

const LIST = "/dashboard/maintenance/preventive";
const MACHINES = [
  { id: "MAQ00000001", label: "Torno paralelo", description: "torno - Operativa" },
  { id: "MAQ00000002", label: "Prensa hidraulica", description: "prensa - Inactiva" },
];

function field<T extends HTMLElement>(id: string) {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`No hay campo ${id}`);
  }
  return element;
}

const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;
const machineValue = () => document.querySelector<HTMLInputElement>('input[name="id_maquina"]')!.value;

function valuesOf(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as PreventiveFormValues;
}

type Respond = (values: PreventiveFormValues) => PreventiveFormState;

function formProps(respond: Respond, returnTo = LIST) {
  const action = vi.fn(async (_prev: PreventiveFormState, formData: FormData) => respond(valuesOf(formData)));

  return {
    action,
    props: {
      action,
      machines: MACHINES,
      defaultValues: { fecha_programada: "2026-07-20", estado: "pendiente" },
      successNotification: maintenanceNotifications["preventive-maintenance-created"],
      returnTo,
    },
  };
}

async function renderForm(respond: Respond, returnTo?: string) {
  const { action, props } = formProps(respond, returnTo);

  await act(async () => root.render(h(PreventiveForm, props)));

  return action;
}

async function renderInPanel(respond: Respond) {
  const { action, props } = formProps(respond);

  await act(async () =>
    root.render(
      h(RouteSheet, {
        title: "Programar mantenimiento preventivo",
        discardTitle: "¿Descartar el preventivo nuevo?",
        discardDescription: "Se perderán los datos que escribiste en este panel.",
        children: h(PreventiveForm, props),
      }),
    ),
  );

  return action;
}

async function chooseMachine(name: string) {
  await act(async () => field<HTMLInputElement>("id_maquina").focus());
  const option = [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((item) =>
    item.textContent?.includes(name),
  )!;
  await act(async () => option.click());
}

// La maquina y la actividad son los obligatorios sin valor inicial: sin ellos,
// requestSubmit no envia (validacion nativa).
async function fillRequired() {
  await chooseMachine("Prensa hidraulica");
  field<HTMLInputElement>("actividad").value = "Cambio de aceite";
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

const success: Respond = (values) => ({
  status: "success",
  data: { id_mantenimiento: "MTP00000010" },
  values,
  operationId: "op-ok",
});

const MACHINE_ERROR = "La máquina seleccionada no existe.";

const machineRejected: Respond = (values) => ({
  status: "error",
  error: MACHINE_ERROR,
  fieldErrors: { id_maquina: [MACHINE_ERROR] },
  values,
  operationId: "op-1",
});

describe("PreventiveForm", () => {
  it("con error conserva lo escrito y la maquina, enfoca el campo invalido y no da ningun otro aviso", async () => {
    await renderForm(machineRejected);
    await fillRequired();
    field<HTMLInputElement>("fecha_programada").value = "2026-08-01";
    field<HTMLSelectElement>("estado").value = "vencido";
    field<HTMLInputElement>("responsable").value = "Rosa Huaman";
    field<HTMLTextAreaElement>("observaciones").value = "Usar aceite ISO 68";

    await submit();

    expect(machineValue()).toBe("MAQ00000002");
    expect(field<HTMLInputElement>("id_maquina").value).toBe("Prensa hidraulica");
    expect(field<HTMLInputElement>("fecha_programada").value).toBe("2026-08-01");
    expect(field<HTMLSelectElement>("estado").value).toBe("vencido");
    expect(field<HTMLInputElement>("responsable").value).toBe("Rosa Huaman");
    expect(field<HTMLInputElement>("actividad").value).toBe("Cambio de aceite");
    expect(field<HTMLTextAreaElement>("observaciones").value).toBe("Usar aceite ISO 68");

    const combobox = field<HTMLInputElement>("id_maquina");

    expect(combobox.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(combobox);
    expect(field("id_maquina-error").textContent).toBe(MACHINE_ERROR);
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(MACHINE_ERROR);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("muestra el error de un campo junto a ese campo", async () => {
    await renderForm((values) => ({
      status: "error",
      error: "Revisa los datos del mantenimiento.",
      fieldErrors: { fecha_programada: ["La fecha programada no es válida."] },
      values,
      operationId: "op-1",
    }));
    await fillRequired();

    await submit();

    const date = field<HTMLInputElement>("fecha_programada");

    expect(date.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(date);
    expect(document.body.textContent).toContain("La fecha programada no es válida.");
  });

  it("envia la maquina elegida y da un solo aviso al guardar y vuelve al listado", async () => {
    const action = await renderForm(success);
    await fillRequired();

    await submit();

    expect(valuesOf(action.mock.calls[0][1])).toMatchObject({
      id_maquina: "MAQ00000002",
      fecha_programada: "2026-07-20",
      estado: "pendiente",
      actividad: "Cambio de aceite",
    });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(maintenanceNotifications["preventive-maintenance-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("con filtros en el listado el aviso lo advierte y vuelve al listado filtrado", async () => {
    const filtered = `${LIST}?status=vencido`;
    await renderForm(success, filtered);
    await fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...maintenanceNotifications["preventive-maintenance-created"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
    expect(navigation.push).toHaveBeenCalledWith(filtered);
  });

  it("en la pagina, Cancelar es un enlace al listado", async () => {
    await renderForm(success);

    const link = [...document.querySelectorAll("a")].find((item) => item.textContent === "Cancelar");

    expect(link?.getAttribute("href")).toBe(LIST);
  });
});

describe("PreventiveForm en el panel lateral", () => {
  it("Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    await act(async () => button("Cancelar").click());

    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("elegir una maquina sin escribir cuenta como cambio y Cancelar pide confirmar", async () => {
    await renderInPanel(success);
    await chooseMachine("Torno paralelo");

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar el preventivo nuevo?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await fillRequired();
    await act(async () => field("actividad").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("con error el panel sigue abierto con lo escrito", async () => {
    await renderInPanel(machineRejected);
    await fillRequired();

    await submit();

    expect(field<HTMLInputElement>("actividad").value).toBe("Cambio de aceite");
    expect(machineValue()).toBe("MAQ00000002");
    expect(navigation.back).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
