// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { productionNotifications } from "@/modules/production/notifications";
import type { RecipeDetailFormState } from "@/modules/production/recipe-details/actions";
import { RecipeDetailForm } from "@/modules/production/recipe-details/recipe-detail-form";

// Formulario de lineas de receta con React real (entrega 10.6b). La accion devuelve
// un resultado: con error se conserva lo escrito y el mensaje queda dentro; con
// exito hay un solo aviso y se vuelve al returnTo. El simulador no se guarda, asi
// que no cuenta como un cambio que haya que descartar.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/production/recipes/REC00000001/versions/VER00000001/details/new",
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

const LIST = "/dashboard/production/recipes/REC00000001/versions/VER00000001/details";
const MATERIALS = [
  { id: "MAT00000001", label: "Plancha de acero", description: "insumos", unidad_medida: "kg" },
  { id: "MAT00000002", label: "Pintura", description: "insumos", unidad_medida: "gl" },
];
const VALUES = {
  id_detalle_receta: "DRE00000007",
  id_material: "MAT00000002",
  cantidad_requerida: "2.5",
  merma_estimada_porcentaje: "10",
  tipo_consumo: "consumible",
  observaciones: "Dos manos",
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

type Respond = (formData: FormData) => RecipeDetailFormState;

const valuesOf = (formData: FormData) => ({
  id_material: String(formData.get("id_material")),
  cantidad_requerida: String(formData.get("cantidad_requerida")),
  merma_estimada_porcentaje: String(formData.get("merma_estimada_porcentaje")),
  tipo_consumo: String(formData.get("tipo_consumo")),
  observaciones: String(formData.get("observaciones")),
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_detalle_receta: "DRE00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

const formProps = (respond: Respond, overrides: Record<string, unknown> = {}) => ({
  action: vi.fn(async (_prev: RecipeDetailFormState, formData: FormData) => respond(formData)),
  versionId: "VER00000001",
  materials: MATERIALS,
  defaultValues: VALUES,
  submitLabel: "Guardar cambios",
  successNotification: productionNotifications["recipe-detail-updated"],
  returnTo: LIST,
  ...overrides,
});

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const props = formProps(respond, overrides);

  await act(async () => root.render(h(RecipeDetailForm, props)));

  return props.action;
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

// Escribe como el navegador, para que React vea el cambio de un campo controlado.
async function type(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("RecipeDetailForm", () => {
  it("abre con los datos de la linea y envia sus ids", async () => {
    const action = await renderForm(success);

    expect(field<HTMLInputElement>("id_material").value).toBe("Pintura");
    expect(field<HTMLInputElement>("cantidad_requerida").value).toBe("2.5");
    expect(field<HTMLSelectElement>("tipo_consumo").value).toBe("consumible");

    await submit();

    const sent = action.mock.calls[0]?.[1] as FormData;
    expect(sent.get("id_detalle_receta")).toBe("DRE00000007");
    expect(sent.get("id_version_receta")).toBe("VER00000001");
    expect(sent.has("preview_quantity")).toBe(false);
  });

  it("con error conserva lo escrito, enfoca el campo y no da avisos", async () => {
    const message = "La cantidad requerida debe ser de al menos 0.01.";
    await renderForm((formData) => ({
      status: "error",
      error: "Revisa los datos del material.",
      fieldErrors: { cantidad_requerida: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    await type(field<HTMLInputElement>("cantidad_requerida"), "0.5");
    await act(async () => {
      field<HTMLSelectElement>("tipo_consumo").value = "auxiliar";
      field<HTMLTextAreaElement>("observaciones").value = "Otra nota";
    });

    await submit();

    expect(field<HTMLInputElement>("cantidad_requerida").value).toBe("0.5");
    expect(field<HTMLSelectElement>("tipo_consumo").value).toBe("auxiliar");
    expect(field<HTMLTextAreaElement>("observaciones").value).toBe("Otra nota");
    expect(hidden("id_material")?.value).toBe("MAT00000002");
    expect(document.activeElement).toBe(field("cantidad_requerida"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos del material.");
    expect(field("cantidad_requerida-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("un error del material enfoca el selector", async () => {
    const message = "Este material ya está registrado en esta versión de receta.";
    await renderForm((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { id_material: [message] },
      values: valuesOf(formData),
      operationId: "op-2",
    }));

    await submit();

    expect(field("id_material").getAttribute("aria-invalid")).toBe("true");
    expect(field("id_material-error").textContent).toBe(message);
    expect(document.activeElement).toBe(field("id_material"));
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(productionNotifications["recipe-detail-updated"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("Cancelar es un enlace al returnTo", async () => {
    await renderForm(success);
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(cancel?.getAttribute("href")).toBe(LIST);
  });

  it("deshabilitado no deja guardar", async () => {
    await renderForm(success, { disabled: true });

    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(field<HTMLInputElement>("cantidad_requerida").disabled).toBe(true);
    expect(field<HTMLSelectElement>("tipo_consumo").disabled).toBe(true);
  });

  it("muestra los avisos que recibe dentro del formulario", async () => {
    await renderForm(success, { notices: h("p", { id: "aviso" }, "Aviso de la pagina") });

    expect(document.querySelector("form #aviso")?.textContent).toBe("Aviso de la pagina");
  });

  it("el simulador calcula con la cantidad, la merma y la orden", async () => {
    await renderForm(success);

    await type(field<HTMLInputElement>("preview_quantity"), "4");

    expect(host.textContent).toContain("2.75 gl");
    expect(host.textContent).toContain("11.00 gl");
  });
});

describe("RecipeDetailForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Editar material de receta",
          discardTitle: "¿Descartar los cambios del material?",
          discardDescription: "Se perderán los cambios que hiciste en este panel.",
          children: h(RecipeDetailForm, formProps(respond)),
        }),
      ),
    );
  }

  it("Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    await act(async () => button("Cancelar").click());

    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("usar el simulador no cuenta como un cambio", async () => {
    await renderInPanel(success);

    await type(field<HTMLInputElement>("preview_quantity"), "25");
    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("cambiar la cantidad si pide confirmar el descarte", async () => {
    await renderInPanel(success);

    await type(field<HTMLInputElement>("cantidad_requerida"), "3");
    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar los cambios del material?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra sin confirmar", async () => {
    await renderInPanel(success);
    await type(field<HTMLInputElement>("cantidad_requerida"), "3");

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
