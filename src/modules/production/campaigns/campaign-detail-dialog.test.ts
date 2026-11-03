// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignDetailFormState, CampaignDetailFormValues } from "@/modules/production/campaigns/actions";
import { CampaignDetailDialog } from "@/modules/production/campaigns/campaign-detail-dialog";
import { productionNotifications } from "@/modules/production/notifications";

// Agregar producto a una campana en ventana modal (entrega 10.7a), con el Radix
// real. Sustituye a la pagina details/new (D3): guardar da un solo aviso y la cierra;
// con error conserva lo escrito y enfoca el campo, sin toast.

const notifications = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverDouble {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
  notifications.notify.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function button(text: string) {
  const element = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  if (!element) {
    throw new Error(`No hay boton "${text}"`);
  }
  return element;
}

const dialog = () => document.querySelector('[role="dialog"]');
const confirmation = () => document.querySelector('[role="alertdialog"]');
const field = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const PRODUCTS = [
  { id_producto: "PRO00000001", nombre_producto: "Lampa", categoria: "herramientas", unidad_medida: "unidad" },
  { id_producto: "PRO00000002", nombre_producto: "Pico", categoria: "herramientas", unidad_medida: "unidad" },
];

function valuesOf(formData: FormData) {
  return {
    id_producto: String(formData.get("id_producto") ?? ""),
    cantidad_objetivo: String(formData.get("cantidad_objetivo") ?? ""),
    observaciones: String(formData.get("observaciones") ?? ""),
  } satisfies CampaignDetailFormValues;
}

type Respond = (values: CampaignDetailFormValues) => CampaignDetailFormState;

function actionWith(respond: Respond) {
  return vi.fn(async (_prev: CampaignDetailFormState, formData: FormData) => respond(valuesOf(formData)));
}

const success: Respond = (values) => ({
  status: "success",
  data: { id_campania_detalle: "CPD00000012" },
  values,
  operationId: "op-ok",
});

async function renderDialog(action: ReturnType<typeof actionWith>, products = PRODUCTS) {
  await act(async () =>
    root.render(
      h(CampaignDetailDialog, {
        action,
        idCampania: "CAM00000003",
        nombreCampania: "Campaña escolar",
        products,
        successNotification: productionNotifications["campaign-detail-created"],
      }),
    ),
  );
}

async function open() {
  const trigger = button("Agregar producto");
  trigger.focus();
  await act(async () => trigger.click());

  return trigger;
}

async function fill() {
  field<HTMLSelectElement>("id_producto").value = "PRO00000002";
  field<HTMLInputElement>("cantidad_objetivo").value = "25";
  field<HTMLTextAreaElement>("observaciones").value = "Primera semana";
}

async function submit() {
  await act(async () => dialog()?.querySelector("form")?.requestSubmit());
  await settle();
}

describe("CampaignDetailDialog", () => {
  it("la abre su boton, nombra la campaña y lista los productos con categoria y unidad", async () => {
    await renderDialog(actionWith(success));

    await open();

    expect(dialog()?.textContent).toContain("Agregar producto a campaña");
    expect(dialog()?.textContent).toContain("Campaña: Campaña escolar");
    expect(dialog()?.textContent).toContain("Un producto solo puede registrarse una vez");
    expect([...field<HTMLSelectElement>("id_producto").options].map((option) => option.textContent)).toEqual([
      "Seleccione un producto",
      "Lampa · herramientas · unidad",
      "Pico · herramientas · unidad",
    ]);
  });

  it("envia la campaña en un campo oculto", async () => {
    const action = actionWith(success);
    await renderDialog(action);
    await open();
    await fill();

    await submit();

    expect((action.mock.calls[0]?.[1] as FormData).get("id_campania")).toBe("CAM00000003");
  });

  it("al guardar da un solo aviso y se cierra", async () => {
    await renderDialog(actionWith(success));
    await open();
    await fill();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(productionNotifications["campaign-detail-created"]);
    expect(dialog()).toBeNull();
  });

  it("con error conserva lo escrito, enfoca el campo y no da aviso", async () => {
    const message = "Ese producto ya está registrado en la campaña.";
    await renderDialog(
      actionWith((values) => ({
        status: "error",
        error: message,
        fieldErrors: { id_producto: [message] },
        values,
        operationId: "op-1",
      })),
    );
    await open();
    await fill();

    await submit();

    expect(field<HTMLSelectElement>("id_producto").value).toBe("PRO00000002");
    expect(field<HTMLInputElement>("cantidad_objetivo").value).toBe("25");
    expect(field<HTMLTextAreaElement>("observaciones").value).toBe("Primera semana");
    expect(document.activeElement).toBe(field("id_producto"));
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(field("id_producto-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(dialog()).not.toBeNull();
  });

  it("sin productos disponibles avisa y no deja guardar", async () => {
    await renderDialog(actionWith(success), []);

    await open();

    expect(dialog()?.textContent).toContain("No hay productos activos disponibles para agregar");
    expect(field<HTMLSelectElement>("id_producto").disabled).toBe(true);
    expect(field<HTMLInputElement>("cantidad_objetivo").disabled).toBe(true);
    expect(dialog()?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderDialog(actionWith(success));
    await open();
    const cantidad = field<HTMLInputElement>("cantidad_objetivo");
    cantidad.value = "5";
    await act(async () => cantidad.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(confirmation()?.textContent).toContain("¿Descartar el producto?");
    expect(dialog()).not.toBeNull();
  });

  it("sin cambios, Cancelar cierra y el foco vuelve al boton", async () => {
    await renderDialog(actionWith(success));
    const trigger = await open();

    await act(async () => button("Cancelar").click());
    await settle();

    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
