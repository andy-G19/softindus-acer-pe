// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import type { AttendanceFormState } from "@/modules/staff/attendance/actions";
import { AttendanceForm } from "@/modules/staff/attendance/attendance-form";
import { staffNotifications } from "@/modules/staff/notifications";

// Formulario de asistencia con React real (A8 de la 10.8a). La accion devuelve un
// resultado en lugar de lanzar: con error se conserva lo escrito, el mensaje queda
// dentro del formulario sin toast y el foco va al campo invalido; con exito hay un
// solo aviso y se vuelve al returnTo. Las «Reglas de uso», que la pagina mostraba
// en una tarjeta lateral, son ayudas de los campos (D10): el panel tambien las ve.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/staff/attendance/new",
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

const LIST = "/dashboard/staff/attendance";
const OPERATORS = [
  { id: "OPE00000003", label: "Huaman, Luis", description: "Soldador" },
  { id: "OPE00000004", label: "Quispe, Ana", description: "Armadora" },
];
const VALUES = {
  id_operario: "OPE00000003",
  fecha: "2026-07-15",
  hora_ingreso: "",
  hora_salida: "",
  tardanza: false,
  falta: false,
  observaciones: "",
};

function field<T extends HTMLElement>(id: string) {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`No hay campo ${id}`);
  }
  return element;
}

const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;

type Respond = (formData: FormData) => AttendanceFormState;

const valuesOf = (formData: FormData) => ({
  id_operario: String(formData.get("id_operario") ?? ""),
  fecha: String(formData.get("fecha") ?? ""),
  hora_ingreso: String(formData.get("hora_ingreso") ?? ""),
  hora_salida: String(formData.get("hora_salida") ?? ""),
  tardanza: formData.get("tardanza") === "on",
  falta: formData.get("falta") === "on",
  observaciones: String(formData.get("observaciones") ?? ""),
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_asistencia: "ASI00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: AttendanceFormState, formData: FormData) => respond(formData));

  return {
    action,
    props: {
      action,
      operators: OPERATORS,
      defaultValues: { ...VALUES, hora_ingreso: "08:00" },
      successNotification: staffNotifications["attendance-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(AttendanceForm, props)));

  return action;
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

describe("AttendanceForm", () => {
  it("con error conserva lo escrito y el operario, marca el campo y lo enfoca, sin otro aviso", async () => {
    const message = "La hora de salida debe ser mayor que la hora de ingreso.";
    await renderForm((formData) => ({
      status: "error",
      error: "Revisa los datos de la asistencia.",
      fieldErrors: { hora_salida: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    field<HTMLInputElement>("hora_salida").value = "07:00";
    field<HTMLInputElement>("tardanza").checked = true;
    field<HTMLTextAreaElement>("observaciones").value = "Llegó en el turno de la tarde";

    await submit();

    expect(field<HTMLInputElement>("hora_ingreso").value).toBe("08:00");
    expect(field<HTMLInputElement>("hora_salida").value).toBe("07:00");
    expect(field<HTMLInputElement>("tardanza").checked).toBe(true);
    expect(field<HTMLTextAreaElement>("observaciones").value).toBe("Llegó en el turno de la tarde");
    expect(document.querySelector<HTMLInputElement>('input[type="hidden"][name="id_operario"]')?.value).toBe(
      "OPE00000003",
    );
    expect(field("hora_salida").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field("hora_salida"));
    expect(field("hora_salida-error").textContent).toBe(message);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos de la asistencia.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
  });

  it("un error del operario marca su buscador, muestra el mensaje y lo enfoca", async () => {
    const message = "El operario seleccionado no existe o está inactivo.";
    await renderForm((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { id_operario: [message] },
      values: valuesOf(formData),
      operationId: "op-2",
    }));

    await submit();

    expect(field("id_operario").getAttribute("aria-invalid")).toBe("true");
    expect(field("id_operario").getAttribute("aria-describedby")).toBe("id_operario-ayuda id_operario-error");
    expect(field("id_operario-error").textContent).toBe(message);
    expect(document.activeElement).toBe(field("id_operario"));
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(staffNotifications["attendance-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("las reglas de uso son ayudas de sus campos", async () => {
    await renderForm(success);

    expect(document.body.textContent).toContain("Cada operario solo puede tener un registro de asistencia por día.");
    expect(document.body.textContent).toContain("Con ingreso y salida se calculan las horas trabajadas.");
    expect(document.body.textContent).toContain("Si marcas falta, deja vacías las horas de ingreso y salida.");
    expect(document.body.textContent).toContain("Las asistencias sin falta cuentan en la planilla del operario.");
  });

  it("sin operarios activos lo dice y no muestra el formulario", async () => {
    await renderForm(success, { operators: [] });

    expect(document.body.textContent).toContain("No hay operarios activos disponibles.");
    expect(document.querySelector("form")).toBeNull();
    expect(document.querySelector('a[href="/dashboard/staff/operators"]')).not.toBeNull();
  });
});

describe("AttendanceForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { props } = formProps(respond, { returnTo: `${LIST}?estado=falta` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Registrar asistencia",
          discardTitle: "¿Descartar la asistencia?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(AttendanceForm, props),
        }),
      ),
    );
  }

  it("Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("con un cambio escrito, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const observaciones = field<HTMLTextAreaElement>("observaciones");
    observaciones.value = "Permiso";
    await act(async () => observaciones.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la asistencia?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await act(async () => field("observaciones").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
