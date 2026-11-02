// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { productionNotifications } from "@/modules/production/notifications";
import type { RecipeVersionFormState } from "@/modules/production/recipe-versions/actions";
import { RecipeVersionForm } from "@/modules/production/recipes/components/recipe-version-form";

// Alta de version con React real (entrega 10.6b), una superficie amplia con lineas:
// parte de la version base, no valida en el cliente, cada error va a su linea y lo
// escrito sobrevive al resultado de la accion.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/production/recipes/REC00000003/versions/new",
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

const LIST = "/dashboard/production/recipes/REC00000003/versions";
const MATERIALS = [
  { id_material: "MAT00000001", nombre_material: "Plancha de acero", categoria: "Acero", unidad_medida: "kg", costo_unitario_actual: "12.5" },
  { id_material: "MAT00000002", nombre_material: "Pintura", categoria: "Acabados", unidad_medida: "gl", costo_unitario_actual: "40" },
];
const BASE = [
  { key: "DRE00000001", id_material: "MAT00000001", cantidad_requerida: "2.5", tipo_consumo: "materia_prima", merma_estimada_porcentaje: "5", observaciones: "Corte" },
  { key: "DRE00000002", id_material: "MAT00000002", cantidad_requerida: "1", tipo_consumo: "consumible", merma_estimada_porcentaje: "0", observaciones: "" },
];

type Respond = (formData: FormData) => RecipeVersionFormState;

const values = (formData: FormData) => ({
  id_receta: String(formData.get("id_receta")),
  numero_version: "",
  motivo_cambio: String(formData.get("motivo_cambio")),
  detalles: [],
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_version_receta: "VER00000012" },
  values: values(formData),
  operationId: "op-ok",
});

const rejected =
  (fieldErrors: Record<string, string[]>, error = "Revisa los datos de la versión."): Respond =>
  (formData) => ({ status: "error", error, fieldErrors, values: values(formData), operationId: "op-1" });

async function renderForm(
  respond: Respond,
  options: { initialDetails?: typeof BASE; canCreateVersion?: boolean } = {},
) {
  const action = vi.fn(async (_prev: RecipeVersionFormState, formData: FormData) => respond(formData));

  await act(async () =>
    root.render(
      h(RecipeVersionForm, {
        action,
        idReceta: "REC00000003",
        returnTo: LIST,
        materials: MATERIALS,
        initialDetails: "initialDetails" in options ? options.initialDetails : BASE,
        canCreateVersion: options.canCreateVersion ?? true,
        successNotification: productionNotifications["recipe-version-created"],
      }),
    ),
  );

  return action;
}

const field = <T extends HTMLElement>(id: string) => document.querySelector<T>(`[id="${id}"]`)!;
const buttons = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].filter((item) => item.textContent?.trim() === text);
const button = (text: string) => buttons(text)[0];
const cancel = () => document.querySelector<HTMLAnchorElement>(`a[href="${LIST}"]`)!;
const discard = () => document.querySelector('[role="alertdialog"]');
const submit = () => act(async () => document.querySelector("form")!.requestSubmit());
const add = () => act(async () => button("Agregar material").click());
const lines = (name: string) =>
  [...document.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)].map((input) => input.value);

async function setInput(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function setSelect(element: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;

  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("RecipeVersionForm: lineas", () => {
  it("parte de la version base", async () => {
    await renderForm(success);

    expect(lines("id_material")).toEqual(["MAT00000001", "MAT00000002"]);
    expect(field<HTMLInputElement>("cantidad_requerida-DRE00000001").value).toBe("2.5");
    expect(field<HTMLSelectElement>("tipo_consumo-DRE00000002").value).toBe("consumible");
    expect(field<HTMLInputElement>("merma_estimada_porcentaje-DRE00000001").value).toBe("5");
    expect(field<HTMLInputElement>("observaciones_detalle-DRE00000001").value).toBe("Corte");
  });

  it("sin base empieza con una linea vacia", async () => {
    await renderForm(success, { initialDetails: [] });

    expect(lines("id_material")).toEqual([""]);
    expect(field<HTMLInputElement>("cantidad_requerida-row-1").value).toBe("1");
    expect(field<HTMLSelectElement>("tipo_consumo-row-1").value).toBe("materia_prima");
  });

  it("cada control tiene su etiqueta", async () => {
    await renderForm(success);

    for (const id of [
      "cantidad_requerida-DRE00000002",
      "tipo_consumo-DRE00000002",
      "merma_estimada_porcentaje-DRE00000002",
      "observaciones_detalle-DRE00000002",
      "motivo_cambio",
    ]) {
      expect(document.querySelector(`label[for="${id}"]`), id).not.toBeNull();
    }
  });

  it("agregar suma una linea y quitar lleva el foco a Agregar material", async () => {
    await renderForm(success);
    await add();

    expect(lines("id_material")).toEqual(["MAT00000001", "MAT00000002", ""]);
    expect(document.body.textContent).toContain("Material 3");

    await act(async () => buttons("Quitar")[0].click());

    expect(lines("id_material")).toEqual(["MAT00000002", ""]);
    expect(document.activeElement).toBe(button("Agregar material"));
  });

  it("la ultima linea no se quita", async () => {
    await renderForm(success, { initialDetails: [] });

    expect(button("Quitar").disabled).toBe(true);
  });
});

describe("RecipeVersionForm: resultado", () => {
  it("no valida en el cliente: un material repetido llega a la accion", async () => {
    const action = await renderForm(success, { initialDetails: [BASE[0], { ...BASE[1], id_material: "MAT00000001" }] });

    await submit();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("una linea sin material llega a la accion, que responde en su linea", async () => {
    const action = await renderForm(rejected({ "detalles.0.id_material": ["Seleccione un material."] }), {
      initialDetails: [],
    });

    await submit();

    expect(action).toHaveBeenCalledTimes(1);
    expect(field("id_material-row-1-error").textContent).toBe("Seleccione un material.");
  });

  it("envia la receta y las lineas en orden", async () => {
    const action = await renderForm(success);

    await submit();

    const formData = action.mock.calls[0][1];

    expect(formData.get("id_receta")).toBe("REC00000003");
    expect(formData.get("motivo_cambio")).toBe("Nueva versión de receta técnica.");
    expect(formData.getAll("id_material")).toEqual(["MAT00000001", "MAT00000002"]);
    expect(formData.getAll("cantidad_requerida")).toEqual(["2.5", "1"]);
    expect(formData.getAll("tipo_consumo")).toEqual(["materia_prima", "consumible"]);
    expect(formData.getAll("merma_estimada_porcentaje")).toEqual(["5", "0"]);
    expect(formData.getAll("observaciones_detalle")).toEqual(["Corte", ""]);
  });

  it("una linea de un material inactivo se envia y la accion la rechaza en su linea", async () => {
    const action = await renderForm(
      rejected({ "detalles.0.id_material": ["El material seleccionado no existe o está inactivo."] }),
      { initialDetails: [{ ...BASE[0], id_material: "MAT00000009" }] },
    );

    await submit();

    expect(action.mock.calls[0][1].getAll("id_material")).toEqual(["MAT00000009"]);
    expect(document.body.textContent).toContain("El material seleccionado no existe o está inactivo.");
  });

  it("con exito da un aviso y vuelve a la lista sin preguntar", async () => {
    await renderForm(success);
    await add();
    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(productionNotifications["recipe-version-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
    expect(discard()).toBeNull();
  });

  it("un error general queda en el formulario sin aviso ni salir", async () => {
    await renderForm(rejected({}, "La receta técnica no existe o está inactiva."));
    await submit();

    expect(document.querySelector('[role="alert"]')?.textContent).toContain("La receta técnica no existe o está inactiva.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("cada error va junto a su linea y enfoca el primero", async () => {
    await renderForm(
      rejected({
        "detalles.1.cantidad_requerida": ["La cantidad requerida debe ser de al menos 0.01."],
        "detalles.1.tipo_consumo": ["Seleccione un tipo de consumo válido."],
        "detalles.1.merma_estimada_porcentaje": ["La merma no puede superar 100%."],
        "detalles.1.observaciones": ["Las observaciones no deben superar 700 caracteres."],
      }),
    );
    await submit();

    const quantity = field<HTMLInputElement>("cantidad_requerida-DRE00000002");

    expect(quantity.getAttribute("aria-invalid")).toBe("true");
    expect(field("cantidad_requerida-DRE00000002-error").textContent).toContain("al menos 0.01");
    expect(field("tipo_consumo-DRE00000002-error").textContent).toContain("tipo de consumo");
    expect(field("merma_estimada_porcentaje-DRE00000002-error").textContent).toContain("100%");
    expect(field("observaciones_detalle-DRE00000002-error").textContent).toContain("700");
    expect(field("cantidad_requerida-DRE00000001").hasAttribute("aria-invalid")).toBe(false);
    expect(document.activeElement).toBe(quantity);
  });

  it("un material repetido se marca en cada linea que lo usa", async () => {
    const message = "No se permite duplicar materiales dentro de la versión.";

    await renderForm(rejected({ "detalles.0.id_material": [message], "detalles.1.id_material": [message] }));
    await submit();

    for (const id of ["id_material-DRE00000001", "id_material-DRE00000002"]) {
      expect(field(id).getAttribute("aria-invalid")).toBe("true");
      expect(field(`${id}-error`).textContent).toBe(message);
    }
  });

  it("lo escrito sobrevive al error, tambien el tipo de consumo y el motivo", async () => {
    await renderForm(rejected({}, "Ya existe una versión con ese número para esta receta."));

    await setInput(field<HTMLInputElement>("cantidad_requerida-DRE00000001"), "7");
    await setSelect(field<HTMLSelectElement>("tipo_consumo-DRE00000001"), "auxiliar");
    await act(async () => {
      const motive = field<HTMLTextAreaElement>("motivo_cambio");

      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(motive, "Cambio de proveedor");
    });
    await submit();

    expect(field<HTMLInputElement>("cantidad_requerida-DRE00000001").value).toBe("7");
    expect(field<HTMLSelectElement>("tipo_consumo-DRE00000001").value).toBe("auxiliar");
    expect(field<HTMLTextAreaElement>("motivo_cambio").value).toBe("Cambio de proveedor");
  });

  it("sin poder crear no deja guardar", async () => {
    await renderForm(success, { canCreateVersion: false });

    expect(button("Crear versión vigente").getAttribute("aria-disabled") ?? String(button("Crear versión vigente").disabled)).toBe("true");
    expect(button("Agregar material").disabled).toBe(true);
    expect(field<HTMLInputElement>("cantidad_requerida-DRE00000001").disabled).toBe(true);
    expect(field<HTMLSelectElement>("tipo_consumo-DRE00000001").disabled).toBe(true);
    expect(field<HTMLInputElement>("merma_estimada_porcentaje-DRE00000001").disabled).toBe(true);
    expect(field<HTMLInputElement>("observaciones_detalle-DRE00000001").disabled).toBe(true);
    expect(field<HTMLTextAreaElement>("motivo_cambio").disabled).toBe(true);
  });
});

describe("RecipeVersionForm: descarte", () => {
  it("sin cambios Cancelar sale sin preguntar", async () => {
    await renderForm(success);

    await act(async () => cancel().click());

    expect(discard()).toBeNull();
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it.each([
    ["escribir", () => setInput(field<HTMLInputElement>("cantidad_requerida-DRE00000001"), "9")],
    ["agregar una linea", add],
    ["quitar una linea de la base", () => act(async () => buttons("Quitar")[0].click())],
  ])("despues de %s Cancelar pregunta", async (_name, change) => {
    await renderForm(success);
    await change();

    await act(async () => cancel().click());

    expect(discard()?.textContent).toContain("¿Descartar la versión nueva?");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("un clic con Ctrl abre la lista sin preguntar", async () => {
    await renderForm(success);
    await add();

    const event = new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true });
    event.preventDefault = vi.fn();

    await act(async () => cancel().dispatchEvent(event));

    expect(discard()).toBeNull();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
