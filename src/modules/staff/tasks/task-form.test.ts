// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { staffNotifications } from "@/modules/staff/notifications";
import type { OperatorTaskFormState } from "@/modules/staff/tasks/actions";
import { TaskForm } from "@/modules/staff/tasks/task-form";

// Formulario de tareas con React real (A9 de la 10.8a). La accion devuelve un
// resultado en lugar de lanzar: con error se conserva lo escrito y lo elegido, el
// mensaje queda dentro del formulario sin toast y el foco va al campo invalido; con
// exito hay un solo aviso y se vuelve al returnTo. Las reglas de uso son ayudas de
// sus campos (D10) y la de las horas dice lo que hace el codigo sin afirmar la
// unidad de la tarifa (D8, hallazgo 71).

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/staff/tasks/new",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

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

const LIST = "/dashboard/staff/tasks";
const OPTIONS = {
  operators: [{ id: "OPE00000003", label: "Huaman, Luis", description: "Soldador" }],
  workOrders: [{ id: "OTR00000006", label: "OTR00000006 - Lampa", description: "Cantidad: 10" }],
  stages: [{ id: "ETA00000005", label: "Lampa - Corte", description: "Ruta lampa - Secuencia 1" }],
};
const VALUES = {
  id_operario: "OPE00000003",
  id_orden_trabajo: "OTR00000006",
  id_etapa_ruta: "",
  fecha_tarea: "2026-07-15",
  descripcion: "Corte de piezas para lote de lampas",
  horas_dedicadas: "",
  estado: "registrada",
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

type Respond = (formData: FormData) => OperatorTaskFormState;

const valuesOf = (formData: FormData) =>
  Object.fromEntries(Object.keys(VALUES).map((name) => [name, String(formData.get(name) ?? "")])) as typeof VALUES;

const success: Respond = (formData) => ({
  status: "success",
  data: { id_tarea_operario: "TAR00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: OperatorTaskFormState, formData: FormData) => respond(formData));

  return {
    action,
    props: {
      action,
      ...OPTIONS,
      defaultValues: VALUES,
      successNotification: staffNotifications["operator-task-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(TaskForm, props)));

  return action;
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

describe("TaskForm", () => {
  it("con error conserva lo escrito y lo elegido, marca el campo y lo enfoca, sin otro aviso", async () => {
    const message = "Las horas dedicadas no pueden superar 24 horas.";
    await renderForm((formData) => ({
      status: "error",
      error: "Revisa los datos de la tarea.",
      fieldErrors: { horas_dedicadas: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    // El navegador no envia 25 (max=24): el error lo devuelve el servidor con un valor
    // que el navegador acepta.
    field<HTMLInputElement>("horas_dedicadas").value = "7.5";
    field<HTMLSelectElement>("estado").value = "terminada";

    await submit();

    expect(field<HTMLInputElement>("horas_dedicadas").value).toBe("7.5");
    expect(field<HTMLSelectElement>("estado").value).toBe("terminada");
    expect(field<HTMLInputElement>("descripcion").value).toBe("Corte de piezas para lote de lampas");
    expect(document.querySelector<HTMLInputElement>('input[type="hidden"][name="id_orden_trabajo"]')?.value).toBe(
      "OTR00000006",
    );
    expect(field("horas_dedicadas").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field("horas_dedicadas"));
    expect(field("horas_dedicadas-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
  });

  it("un error de la etapa marca su buscador y lo enfoca", async () => {
    const message = "La etapa seleccionada no pertenece a la ruta de fabricación de la orden.";
    await renderForm((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { id_etapa_ruta: [message] },
      values: valuesOf(formData),
      operationId: "op-2",
    }));

    await submit();

    expect(field("id_etapa_ruta").getAttribute("aria-invalid")).toBe("true");
    expect(field("id_etapa_ruta-error").textContent).toBe(message);
    expect(document.activeElement).toBe(field("id_etapa_ruta"));
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(staffNotifications["operator-task-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("las reglas de uso son ayudas de sus campos y no ofrecen anular", async () => {
    await renderForm(success);

    expect(document.body.textContent).toContain("Si eliges una etapa, debe pertenecer a la ruta de fabricación de la orden.");
    expect(document.body.textContent).toContain(
      "Al generar un costeo, la mano de obra se estima con estas horas y la tarifa del operario.",
    );
    expect([...field<HTMLSelectElement>("estado").options].map((option) => option.value)).toEqual([
      "registrada",
      "en_proceso",
      "terminada",
    ]);
  });

  it("sin operarios activos u ordenes lo dice y no muestra el formulario", async () => {
    await renderForm(success, { workOrders: [] });

    expect(document.body.textContent).toContain("Faltan datos para registrar tareas.");
    expect(document.querySelector("form")).toBeNull();
  });
});

describe("TaskForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { props } = formProps(respond);

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Registrar tarea",
          discardTitle: "¿Descartar la tarea?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(TaskForm, props),
        }),
      ),
    );
  }

  it("con un cambio escrito, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const descripcion = field<HTMLInputElement>("descripcion");
    descripcion.value = "Soldadura de mangos";
    await act(async () => descripcion.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la tarea?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await act(async () => field("descripcion").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });
});
