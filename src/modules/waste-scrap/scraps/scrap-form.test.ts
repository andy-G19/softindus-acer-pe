// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { wasteScrapNotifications } from "@/modules/waste-scrap/notifications";
import type { ScrapFormState } from "@/modules/waste-scrap/scraps/actions";
import { ScrapForm } from "@/modules/waste-scrap/scraps/scrap-form";

// Formulario de chatarra con React real (entrega 10.7a). La accion devuelve un
// resultado en lugar de lanzar: con error se conserva lo escrito, tambien el material
// y la orden, y el mensaje queda dentro del formulario; con exito hay un solo aviso y
// se vuelve al returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/waste-scrap/scraps/new",
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
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const LIST = "/dashboard/waste-scrap/scraps";
const MATERIALS = [{ id: "MAT00000002", label: "Plancha", description: "planchas - Stock: 10 kg" }];
const ORDERS = [{ id: "OTR00000003", label: "OTR00000003 - Lampa", description: "en_proceso" }];

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

type Respond = (formData: FormData) => ScrapFormState;

const valuesOf = (formData: FormData) => ({
  id_material: String(formData.get("id_material")),
  id_orden_trabajo: String(formData.get("id_orden_trabajo")),
  tipo_material: String(formData.get("tipo_material")),
  peso_kg: String(formData.get("peso_kg")),
  cantidad: String(formData.get("cantidad")),
  observaciones: String(formData.get("observaciones")),
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_chatarra: "CHA00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: ScrapFormState, formData: FormData) => respond(formData));

  return {
    action,
    props: {
      action,
      materials: MATERIALS,
      workOrders: ORDERS,
      successNotification: wasteScrapNotifications["scrap-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(ScrapForm, props)));

  return action;
}

async function fill() {
  field<HTMLInputElement>("tipo_material").value = "Acero";
  field<HTMLInputElement>("peso_kg").value = "12.5";
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

describe("ScrapForm", () => {
  it("con error conserva lo escrito, enfoca el campo y no da otro aviso", async () => {
    const message = "Debe registrar al menos peso en kg o cantidad aproximada.";
    await renderForm((formData) => ({
      status: "error",
      error: "Revisa los datos de la chatarra.",
      fieldErrors: { peso_kg: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    await fill();
    field<HTMLInputElement>("cantidad").value = "3";
    field<HTMLTextAreaElement>("observaciones").value = "Corte de planchas";

    await submit();

    expect(field<HTMLInputElement>("tipo_material").value).toBe("Acero");
    expect(field<HTMLInputElement>("peso_kg").value).toBe("12.5");
    expect(field<HTMLInputElement>("cantidad").value).toBe("3");
    expect(field<HTMLTextAreaElement>("observaciones").value).toBe("Corte de planchas");
    expect(document.activeElement).toBe(field("peso_kg"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos de la chatarra.");
    expect(field("peso_kg-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("un error del material enfoca su selector", async () => {
    const message = "No se puede registrar chatarra de un material inactivo.";
    await renderForm((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { id_material: [message] },
      values: valuesOf(formData),
      operationId: "op-2",
    }));
    await fill();

    await submit();

    expect(field("id_material").getAttribute("aria-invalid")).toBe("true");
    expect(field("id_material-error").textContent).toBe(message);
    expect(document.activeElement).toBe(field("id_material"));
  });

  it("un error de la orden enfoca su selector", async () => {
    const message = "No se puede asociar chatarra a una orden anulada.";
    await renderForm((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { id_orden_trabajo: [message] },
      values: valuesOf(formData),
      operationId: "op-3",
    }));
    await fill();

    await submit();

    expect(field("id_orden_trabajo").getAttribute("aria-invalid")).toBe("true");
    expect(field("id_orden_trabajo-error").textContent).toBe(message);
  });

  it("material y orden son opcionales y se envian vacios", async () => {
    const action = await renderForm(success);
    await fill();

    await submit();

    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id_material")).toBe("");
    expect(sent.get("id_orden_trabajo")).toBe("");
    expect(hidden("id_material")).not.toBeNull();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);
    await fill();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(wasteScrapNotifications["scrap-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que puede no aparecer", async () => {
    await renderForm(success, { returnTo: `${LIST}?estado=vendida` });
    await fill();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...wasteScrapNotifications["scrap-created"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
  });

  it("explica el estado inicial y Cancelar es un enlace al returnTo", async () => {
    const returnTo = `${LIST}?q=acero`;
    await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(host.textContent).toContain("Estado inicial de la chatarra");
    expect(cancel?.getAttribute("href")).toBe(returnTo);
  });
});

describe("ScrapForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { props } = formProps(respond, { returnTo: `${LIST}?q=acero` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Registrar chatarra generada",
          discardTitle: "¿Descartar la chatarra nueva?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(ScrapForm, props),
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

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const tipo = field<HTMLInputElement>("tipo_material");
    tipo.value = "Acero";
    await act(async () => tipo.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la chatarra nueva?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await fill();
    await act(async () => field("tipo_material").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
