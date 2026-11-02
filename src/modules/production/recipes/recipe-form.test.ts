// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import { productionNotifications } from "@/modules/production/notifications";
import type { TechnicalRecipeFormState } from "@/modules/production/recipes/actions";
import { RecipeForm } from "@/modules/production/recipes/recipe-form";

// Formulario de recetas con React real (entrega 10.6b). La accion devuelve un
// resultado en lugar de lanzar: con error se conserva lo escrito, tambien el
// producto elegido, y el mensaje queda dentro del formulario; con exito hay un
// solo aviso y se vuelve al returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/production/recipes/new",
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

const LIST = "/dashboard/production/recipes";
const PRODUCTS = [
  { id: "PRO00000001", label: "Lampa", description: "herramientas - unidad" },
  { id: "PRO00000002", label: "Pico", description: "herramientas - unidad" },
];

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

type Respond = (formData: FormData) => TechnicalRecipeFormState;

const valuesOf = (formData: FormData) => ({
  id_producto: String(formData.get("id_producto")),
  nombre_receta: String(formData.get("nombre_receta")),
  descripcion: String(formData.get("descripcion")),
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_receta: "REC00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

const formProps = (respond: Respond, overrides: Record<string, unknown> = {}) => ({
  action: vi.fn(async (_prev: TechnicalRecipeFormState, formData: FormData) => respond(formData)),
  products: PRODUCTS,
  successNotification: productionNotifications["recipe-created"],
  returnTo: LIST,
  ...overrides,
});

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  await act(async () => root.render(h(RecipeForm, formProps(respond, overrides))));
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

// Elige el producto en el selector real y escribe el nombre, los dos obligatorios.
async function fill(label = "Lampa") {
  const combobox = field<HTMLInputElement>("id_producto");

  await act(async () => combobox.focus());
  await act(async () =>
    [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')]
      .find((item) => item.textContent?.includes(label))!
      .click(),
  );
  field<HTMLInputElement>("nombre_receta").value = "Receta de lampa";
}

describe("RecipeForm", () => {
  it("con error conserva lo escrito y el producto, enfoca el campo y no da otro aviso", async () => {
    const message = "Ya existe una receta con ese nombre para este producto.";
    await renderForm(
      (formData) => ({
        status: "error",
        error: message,
        fieldErrors: { nombre_receta: [message] },
        values: valuesOf(formData),
        operationId: "op-1",
      }),
    );
    await fill("Pico");
    field<HTMLInputElement>("nombre_receta").value = "Receta nueva";
    field<HTMLTextAreaElement>("descripcion").value = "Plancha y pintura";

    await submit();

    expect(field<HTMLInputElement>("nombre_receta").value).toBe("Receta nueva");
    expect(field<HTMLTextAreaElement>("descripcion").value).toBe("Plancha y pintura");
    expect(hidden("id_producto")?.value).toBe("PRO00000002");
    expect(field<HTMLInputElement>("id_producto").value).toBe("Pico");
    expect(document.activeElement).toBe(field("nombre_receta"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(field("nombre_receta-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("un error del producto enfoca el selector", async () => {
    const message = "El producto seleccionado no existe o está inactivo.";
    await renderForm(
      (formData) => ({
        status: "error",
        error: message,
        fieldErrors: { id_producto: [message] },
        values: valuesOf(formData),
        operationId: "op-2",
      }),
    );
    await fill();

    await submit();

    expect(field("id_producto").getAttribute("aria-invalid")).toBe("true");
    expect(field("id_producto-error").textContent).toBe(message);
    expect(document.activeElement).toBe(field("id_producto"));
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);
    await fill();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(productionNotifications["recipe-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que la receta puede no aparecer", async () => {
    await renderForm(success, { returnTo: `${LIST}?status=inactiva` });
    await fill();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...productionNotifications["recipe-created"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
  });

  it("explica que la version va despues y Cancelar es un enlace al returnTo", async () => {
    const returnTo = `${LIST}?q=lampa`;
    await renderForm(success, { returnTo });
    const cancel = [...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(host.textContent).toContain("En esta pantalla solo registramos la cabecera de la receta técnica.");
    expect(host.textContent).toContain("Puedes tener más de una receta por producto");
    expect(cancel?.getAttribute("href")).toBe(returnTo);
  });

  it("sin productos activos avisa y no deja guardar", async () => {
    await renderForm(success, { products: [] });

    expect(host.textContent).toContain("No hay productos activos registrados.");
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });
});

describe("RecipeForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nueva receta técnica",
          discardTitle: "¿Descartar la receta nueva?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(RecipeForm, formProps(respond, { returnTo: `${LIST}?q=lampa` })),
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
    const nombre = field<HTMLInputElement>("nombre_receta");
    nombre.value = "Otra";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la receta nueva?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    await fill();
    await act(async () => field("nombre_receta").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
