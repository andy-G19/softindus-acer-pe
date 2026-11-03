// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import type { ProductionCampaignFormState } from "@/modules/production/campaigns/actions";
import { CampaignForm } from "@/modules/production/campaigns/campaign-form";
import { productionNotifications } from "@/modules/production/notifications";

// Formulario de campanas con React real (entrega 10.7a). La accion devuelve un
// resultado en lugar de lanzar: con error se conserva lo escrito, tambien el estado
// del select, y el mensaje queda dentro del formulario; con exito hay un solo aviso
// y se vuelve al returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/production/campaigns/new",
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

const LIST = "/dashboard/production/campaigns";
const NEW_VALUES = {
  nombre_campania: "",
  fecha_inicio: "2026-07-15",
  fecha_fin: "",
  objetivo_general: "",
  estado: "planificada",
};
const EDIT_VALUES = {
  id_campania: "CAM00000003",
  nombre_campania: "Campaña escolar",
  fecha_inicio: "2026-08-01",
  fecha_fin: "2026-08-31",
  objetivo_general: "Reponer stock",
  estado: "activa",
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

type Respond = (formData: FormData) => ProductionCampaignFormState;

const valuesOf = (formData: FormData) => ({
  nombre_campania: String(formData.get("nombre_campania")),
  fecha_inicio: String(formData.get("fecha_inicio")),
  fecha_fin: String(formData.get("fecha_fin")),
  objetivo_general: String(formData.get("objetivo_general")),
  estado: String(formData.get("estado") ?? ""),
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_campania: "CAM00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: ProductionCampaignFormState, formData: FormData) => respond(formData));

  return {
    action,
    props: {
      action,
      defaultValues: { ...NEW_VALUES, nombre_campania: "Campaña escolar" },
      submitLabel: "Guardar campaña",
      successNotification: productionNotifications["campaign-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(CampaignForm, props)));

  return action;
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

describe("CampaignForm", () => {
  it("con error conserva lo escrito y el estado, enfoca el campo y no da otro aviso", async () => {
    const message = "La fecha de fin no puede ser anterior a la fecha de inicio.";
    await renderForm((formData) => ({
      status: "error",
      error: "Revisa los datos de la campaña.",
      fieldErrors: { fecha_fin: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    field<HTMLInputElement>("nombre_campania").value = "Campaña nueva";
    field<HTMLInputElement>("fecha_fin").value = "2026-07-01";
    field<HTMLTextAreaElement>("objetivo_general").value = "Lote de lampas";
    field<HTMLSelectElement>("estado").value = "activa";

    await submit();

    expect(field<HTMLInputElement>("nombre_campania").value).toBe("Campaña nueva");
    expect(field<HTMLInputElement>("fecha_fin").value).toBe("2026-07-01");
    expect(field<HTMLTextAreaElement>("objetivo_general").value).toBe("Lote de lampas");
    expect(field<HTMLSelectElement>("estado").value).toBe("activa");
    expect(document.activeElement).toBe(field("fecha_fin"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos de la campaña.");
    expect(field("fecha_fin-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(productionNotifications["campaign-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que la campaña puede no aparecer", async () => {
    await renderForm(success, { returnTo: `${LIST}?status=activa` });

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...productionNotifications["campaign-created"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
  });

  it("el alta ofrece el estado y Cancelar es un enlace al returnTo", async () => {
    const returnTo = `${LIST}?q=lote`;
    await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");
    const options = [...field<HTMLSelectElement>("estado").options].map((option) => option.value);

    expect(options).toEqual(["planificada", "activa"]);
    expect(field<HTMLInputElement>("fecha_inicio").value).toBe("2026-07-15");
    expect(cancel?.getAttribute("href")).toBe(returnTo);
  });

  it("la edicion abre con los datos, envia su id y no tiene campo de estado", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      defaultValues: EDIT_VALUES,
    });

    expect(field<HTMLInputElement>("nombre_campania").value).toBe("Campaña escolar");
    expect(field<HTMLInputElement>("fecha_fin").value).toBe("2026-08-31");
    expect(field<HTMLTextAreaElement>("objetivo_general").value).toBe("Reponer stock");
    expect(document.querySelector('[name="estado"]')).toBeNull();

    await submit();

    expect((action.mock.calls[0]?.[1] as FormData).get("id_campania")).toBe("CAM00000003");
  });

  it("una campaña anulada se ve bloqueada y no deja guardar", async () => {
    await renderForm(success, {
      submitLabel: "Guardar cambios",
      defaultValues: { ...EDIT_VALUES, estado: "anulada" },
    });

    expect(host.textContent).toContain("Esta campaña está anulada y ya no puede modificarse.");
    expect(field<HTMLInputElement>("nombre_campania").disabled).toBe(true);
    expect(field<HTMLInputElement>("fecha_inicio").disabled).toBe(true);
    expect(field<HTMLInputElement>("fecha_fin").disabled).toBe(true);
    expect(field<HTMLTextAreaElement>("objetivo_general").disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });
});

describe("CampaignForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { props } = formProps(respond, { returnTo: `${LIST}?q=lote` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nueva campaña de producción",
          discardTitle: "¿Descartar la campaña nueva?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(CampaignForm, props),
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
    const nombre = field<HTMLInputElement>("nombre_campania");
    nombre.value = "Otra";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la campaña nueva?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await act(async () => field("nombre_campania").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
