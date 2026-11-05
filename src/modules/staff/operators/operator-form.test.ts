// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import type { OperatorFormState } from "@/modules/staff/operators/actions";
import { OperatorForm } from "@/modules/staff/operators/operator-form";
import { staffNotifications } from "@/modules/staff/notifications";

// Formulario de operarios con React real (A6 de la 10.8a). La accion devuelve un
// resultado en lugar de redirigir: con error se conserva lo escrito, el mensaje
// queda dentro del formulario sin toast y el foco va al primer campo invalido;
// con exito hay un solo aviso y se vuelve al returnTo. El estado no se edita aqui:
// nace activo y cambia desde la fila (D3).

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/staff/operators/new",
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

const LIST = "/dashboard/staff/operators";
const NEW_VALUES = {
  nombres: "",
  apellidos: "",
  cargo: "",
  especialidad: "",
  telefono: "",
  direccion: "",
  modalidad_pago: "semanal",
  tarifa: "",
  fecha_ingreso: "2026-07-15",
  observaciones: "",
};
const EDIT_VALUES = {
  id_operario: "OPE00000003",
  nombres: "Luis",
  apellidos: "Huaman",
  cargo: "Soldador",
  especialidad: "Soldadura MIG",
  telefono: "987654321",
  direccion: "Av. Industrial 123",
  modalidad_pago: "quincenal",
  tarifa: "80.5",
  fecha_ingreso: "2026-03-02",
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

type Respond = (formData: FormData) => OperatorFormState;

const valuesOf = (formData: FormData) =>
  Object.fromEntries(Object.keys(NEW_VALUES).map((name) => [name, String(formData.get(name) ?? "")])) as typeof NEW_VALUES;

const success: Respond = (formData) => ({
  status: "success",
  data: { id_operario: "OPE00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: OperatorFormState, formData: FormData) => respond(formData));

  return {
    action,
    props: {
      action,
      defaultValues: { ...NEW_VALUES, nombres: "Luis", apellidos: "Huaman" },
      submitLabel: "Registrar operario",
      successNotification: staffNotifications["operator-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(OperatorForm, props)));

  return action;
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

describe("OperatorForm", () => {
  it("con error conserva lo escrito, marca el campo con su mensaje y lo enfoca, sin otro aviso", async () => {
    const message = "La tarifa no debe superar S/ 9,999,999,999.99.";
    await renderForm((formData) => ({
      status: "error",
      error: "Revisa los datos del operario.",
      fieldErrors: { tarifa: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    field<HTMLInputElement>("nombres").value = "Luis Alberto";
    field<HTMLSelectElement>("modalidad_pago").value = "mensual";
    field<HTMLInputElement>("tarifa").value = "10000000000";

    await submit();

    expect(field<HTMLInputElement>("nombres").value).toBe("Luis Alberto");
    expect(field<HTMLSelectElement>("modalidad_pago").value).toBe("mensual");
    expect(field<HTMLInputElement>("tarifa").value).toBe("10000000000");
    expect(field("tarifa").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field("tarifa"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos del operario.");
    expect(field("tarifa-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(staffNotifications["operator-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que el operario puede no aparecer", async () => {
    await renderForm(success, { returnTo: `${LIST}?status=inactivo` });

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...staffNotifications["operator-created"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
  });

  it("no tiene Estado y Cancelar vuelve al returnTo en la pagina completa", async () => {
    await renderForm(success);

    expect(document.querySelector('[name="estado"]')).toBeNull();
    expect([...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar")?.getAttribute("href")).toBe(LIST);
  });

  it("la edicion abre con los datos y envia su id", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      defaultValues: EDIT_VALUES,
      successNotification: staffNotifications["operator-updated"],
    });

    expect(field<HTMLInputElement>("cargo").value).toBe("Soldador");
    expect(field<HTMLSelectElement>("modalidad_pago").value).toBe("quincenal");
    expect(field<HTMLInputElement>("tarifa").value).toBe("80.5");
    expect(field<HTMLInputElement>("fecha_ingreso").value).toBe("2026-03-02");

    await submit();

    expect((action.mock.calls[0]?.[1] as FormData).get("id_operario")).toBe("OPE00000003");
  });
});

describe("OperatorForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { props } = formProps(respond, { returnTo: `${LIST}?q=luis` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Registrar operario",
          discardTitle: "¿Descartar el operario nuevo?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(OperatorForm, props),
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

  it("con un cambio escrito, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const cargo = field<HTMLInputElement>("cargo");
    cargo.value = "Armador";
    await act(async () => cargo.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar el operario nuevo?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await act(async () => field("nombres").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
