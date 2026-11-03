// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { wasteScrapNotifications } from "@/modules/waste-scrap/notifications";
import type { ReusableScrapFormState } from "@/modules/waste-scrap/reusable-scraps/actions";
import { ReusableScrapForm } from "@/modules/waste-scrap/reusable-scraps/reusable-scrap-form";

// Formulario de retazos con React real (entrega 10.7a). La accion devuelve un resultado
// en lugar de lanzar: con error se conserva lo escrito, tambien la unidad del select, y
// el mensaje queda dentro del formulario; con exito hay un solo aviso y se vuelve al
// returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/waste-scrap/reusable-scraps/new",
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

const LIST = "/dashboard/waste-scrap/reusable-scraps";
const MATERIALS = [{ id: "MAT00000002", label: "Plancha", description: "planchas - Stock: 10 kg" }];
const ORDERS = [{ id: "OTR00000003", label: "OTR00000003 - Lampa", description: "en_proceso" }];

function field<T extends HTMLElement>(id: string) {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`No hay campo ${id}`);
  }
  return element;
}

const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;

type Respond = (formData: FormData) => ReusableScrapFormState;

const valuesOf = (formData: FormData) => ({
  id_material: String(formData.get("id_material")),
  id_orden_trabajo: String(formData.get("id_orden_trabajo")),
  medida_aproximada: String(formData.get("medida_aproximada")),
  cantidad: String(formData.get("cantidad")),
  unidad_medida: String(formData.get("unidad_medida")),
  ubicacion: String(formData.get("ubicacion")),
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_retazo: "RET00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: ReusableScrapFormState, formData: FormData) => respond(formData));

  return {
    action,
    props: {
      action,
      materials: MATERIALS,
      workOrders: ORDERS,
      successNotification: wasteScrapNotifications["reusable-scrap-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(ReusableScrapForm, props)));

  return action;
}

const option = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((item) => item.textContent?.includes(label))!;

// SearchableSelect exige una opcion elegida (setCustomValidity): el texto no basta. La
// lista se abre al recibir el foco.
async function choose(id: string, label: string) {
  await act(async () => field(id).focus());
  await act(async () => option(label).click());
}

async function fill() {
  await choose("id_material", "Plancha");
  await choose("id_orden_trabajo", "Lampa");
  field<HTMLInputElement>("cantidad").value = "2";
  field<HTMLSelectElement>("unidad_medida").value = "pieza";
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

describe("ReusableScrapForm", () => {
  it("con error conserva lo escrito y la unidad, enfoca el campo y no da otro aviso", async () => {
    const message = "La cantidad debe ser mayor que cero.";
    await renderForm((formData) => ({
      status: "error",
      error: "Revisa los datos del retazo.",
      fieldErrors: { cantidad: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    await fill();
    field<HTMLInputElement>("medida_aproximada").value = "30 cm x 15 cm";
    field<HTMLInputElement>("ubicacion").value = "Estante A";

    await submit();

    expect(field<HTMLInputElement>("medida_aproximada").value).toBe("30 cm x 15 cm");
    expect(field<HTMLInputElement>("ubicacion").value).toBe("Estante A");
    expect(field<HTMLInputElement>("cantidad").value).toBe("2");
    expect(field<HTMLSelectElement>("unidad_medida").value).toBe("pieza");
    expect(document.activeElement).toBe(field("cantidad"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos del retazo.");
    expect(field("cantidad-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("un error del material enfoca su selector", async () => {
    const message = "No se puede registrar retazos de un material inactivo.";
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
    const message = "No se puede asociar un retazo a una orden anulada.";
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

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);
    await fill();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(wasteScrapNotifications["reusable-scrap-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que puede no aparecer", async () => {
    await renderForm(success, { returnTo: `${LIST}?estado=descartado` });
    await fill();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...wasteScrapNotifications["reusable-scrap-created"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
  });

  it("explica el estado inicial y Cancelar es un enlace al returnTo", async () => {
    const returnTo = `${LIST}?q=plancha`;
    await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(host.textContent).toContain("Podrás marcarlo como reutilizado o descartado desde la lista.");
    expect(cancel?.getAttribute("href")).toBe(returnTo);
  });

  it("sin materiales activos avisa y no deja guardar", async () => {
    await renderForm(success, { materials: [] });

    expect(host.textContent).toContain("No hay materiales activos.");
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });
});

describe("ReusableScrapForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { props } = formProps(respond, { returnTo: `${LIST}?q=plancha` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Registrar retazo reutilizable",
          discardTitle: "¿Descartar el retazo nuevo?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(ReusableScrapForm, props),
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
    const medida = field<HTMLInputElement>("medida_aproximada");
    medida.value = "30 cm";
    await act(async () => medida.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar el retazo nuevo?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await fill();
    await act(async () => field("cantidad").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
