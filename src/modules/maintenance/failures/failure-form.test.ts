// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import type { FailureFormState, FailureFormValues } from "@/modules/maintenance/failures/actions";
import { FailureForm } from "@/modules/maintenance/failures/failure-form";
import { maintenanceNotifications } from "@/modules/maintenance/notifications";

// Formulario de fallas con React real (entrega 10.5b), con el patron de
// Maquinas y Repuestos: la accion devuelve un resultado en lugar de redirigir o
// lanzar, y el formulario decide. Con error conserva lo escrito y la maquina
// elegida, enfoca el primer campo invalido y muestra el error dentro, sin otro
// aviso (antes llevaba a la pagina de error y se perdia lo escrito); con exito
// da un solo aviso y vuelve al returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/maintenance/failures/new",
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

const LIST = "/dashboard/maintenance/failures";
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
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as FailureFormValues;
}

type Respond = (values: FailureFormValues) => FailureFormState;

function formProps(respond: Respond) {
  const action = vi.fn(async (_prev: FailureFormState, formData: FormData) => respond(valuesOf(formData)));

  return {
    action,
    props: {
      action,
      machines: MACHINES,
      defaultValues: { fecha_falla: "2026-07-15T10:00", estado_atencion: "pendiente" },
      successNotification: maintenanceNotifications["failure-created"],
      returnTo: LIST,
    },
  };
}

async function renderForm(respond: Respond) {
  const { action, props } = formProps(respond);

  await act(async () => root.render(h(FailureForm, props)));

  return action;
}

async function renderInPanel(respond: Respond) {
  const { action, props } = formProps(respond);

  await act(async () =>
    root.render(
      h(RouteSheet, {
        title: "Registrar falla de maquinaria",
        discardTitle: "¿Descartar la falla nueva?",
        discardDescription: "Se perderán los datos que escribiste en este panel.",
        children: h(FailureForm, props),
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

// La maquina y la descripcion son los obligatorios sin valor inicial: sin
// ellos, requestSubmit no envia (validacion nativa).
async function fillRequired() {
  await chooseMachine("Prensa hidraulica");
  field<HTMLTextAreaElement>("descripcion").value = "Perdio presion";
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

const success: Respond = (values) => ({
  status: "success",
  data: { id_falla: "FAL00000010" },
  values,
  operationId: "op-ok",
});

const MACHINE_ERROR = "No se puede registrar una falla sobre una maquina inactiva.";

const machineRejected: Respond = (values) => ({
  status: "error",
  error: MACHINE_ERROR,
  fieldErrors: { id_maquina: [MACHINE_ERROR] },
  values,
  operationId: "op-1",
});

describe("FailureForm", () => {
  it("con error conserva lo escrito y la maquina, enfoca el campo invalido y no da ningun otro aviso", async () => {
    await renderForm(machineRejected);
    await fillRequired();
    field<HTMLInputElement>("fecha_falla").value = "2026-07-14T09:30";
    field<HTMLSelectElement>("estado_atencion").value = "en_atencion";
    field<HTMLInputElement>("responsable_registro").value = "Juan Quispe";
    field<HTMLInputElement>("tiempo_perdido_horas").value = "2.5";
    field<HTMLTextAreaElement>("impacto_produccion").value = "Se detuvo el doblado";

    await submit();

    expect(machineValue()).toBe("MAQ00000002");
    expect(field<HTMLInputElement>("id_maquina").value).toBe("Prensa hidraulica");
    expect(field<HTMLInputElement>("fecha_falla").value).toBe("2026-07-14T09:30");
    expect(field<HTMLSelectElement>("estado_atencion").value).toBe("en_atencion");
    expect(field<HTMLTextAreaElement>("descripcion").value).toBe("Perdio presion");
    expect(field<HTMLInputElement>("responsable_registro").value).toBe("Juan Quispe");
    expect(field<HTMLInputElement>("tiempo_perdido_horas").value).toBe("2.5");
    expect(field<HTMLTextAreaElement>("impacto_produccion").value).toBe("Se detuvo el doblado");

    const combobox = field<HTMLInputElement>("id_maquina");

    expect(combobox.getAttribute("aria-invalid")).toBe("true");
    expect(combobox.getAttribute("aria-describedby")).toBe("id_maquina-error");
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
      error: "Revisa los datos de la falla.",
      fieldErrors: { tiempo_perdido_horas: ["El tiempo perdido no debe superar 99,999,999.99."] },
      values,
      operationId: "op-1",
    }));
    await fillRequired();

    await submit();

    const hours = field<HTMLInputElement>("tiempo_perdido_horas");

    expect(hours.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(hours);
    expect(document.body.textContent).toContain("El tiempo perdido no debe superar 99,999,999.99.");
  });

  it("envia la maquina elegida y da un solo aviso al guardar y vuelve al listado", async () => {
    const action = await renderForm(success);
    await fillRequired();

    await submit();

    expect(action).toHaveBeenCalledTimes(1);
    expect(valuesOf(action.mock.calls[0][1])).toMatchObject({
      id_maquina: "MAQ00000002",
      fecha_falla: "2026-07-15T10:00",
      estado_atencion: "pendiente",
      descripcion: "Perdio presion",
    });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(maintenanceNotifications["failure-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("en la pagina, Cancelar es un enlace al listado", async () => {
    await renderForm(success);

    const link = [...document.querySelectorAll("a")].find((item) => item.textContent === "Cancelar");

    expect(link?.getAttribute("href")).toBe(LIST);
  });
});

describe("FailureForm en el panel lateral", () => {
  it("Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    await act(async () => button("Cancelar").click());

    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("escribir y Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const description = field<HTMLTextAreaElement>("descripcion");
    description.value = "Perdio presion";
    await act(async () => description.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la falla nueva?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("elegir una maquina sin escribir tambien cuenta como cambio", async () => {
    await renderInPanel(success);
    await chooseMachine("Torno paralelo");

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la falla nueva?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await fillRequired();
    await act(async () => field("descripcion").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con error el panel sigue abierto con lo escrito", async () => {
    await renderInPanel(machineRejected);
    await fillRequired();

    await submit();

    expect(field<HTMLTextAreaElement>("descripcion").value).toBe("Perdio presion");
    expect(machineValue()).toBe("MAQ00000002");
    expect(navigation.back).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
