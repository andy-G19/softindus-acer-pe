// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkOrderFormState } from "@/modules/production/work-orders/actions";
import { WorkOrderForm } from "@/modules/production/work-orders/components/work-order-form";

// Formulario de crear orden de trabajo (C5 de la 11.6a, D66) con React real: la clave de la
// operacion, lo que conserva tras un error (el tipo, el producto, la ruta, la receta y la cantidad,
// sin pagina de error) y lo que hace tras guardar (un aviso, clave nueva y el detalle de la orden
// creada, no el listado).

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETURN_TO = "/dashboard/production/work-orders?estado=pendiente";
const NOTIFICATION = { type: "success", message: "Orden de trabajo creada correctamente" } as const;
const STORAGE_KEY = "clave-operacion:orden_trabajo:nueva";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  sessionStorage.clear();
  notifications.notify.mockReset();
  notifications.showError.mockReset();
  router.push.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function control<T extends HTMLElement>(selector: string) {
  const element = host.querySelector<T>(selector);

  if (!element) {
    throw new Error(`No hay ${selector}`);
  }

  return element;
}

const FIELDS = [
  "tipo_produccion",
  "id_detalle_pedido",
  "id_campania",
  "id_producto",
  "id_ruta",
  "id_version_receta",
  "cantidad",
  "fecha_inicio",
  "fecha_entrega_estimada",
  "prioridad",
  "observaciones",
] as const;

const valuesOf = (formData: FormData) =>
  Object.fromEntries(FIELDS.map((name) => [name, String(formData.get(name) ?? "")])) as Record<
    (typeof FIELDS)[number],
    string
  >;

async function render(respond: (formData: FormData) => WorkOrderFormState) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: WorkOrderFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => {
    root.render(
      h(WorkOrderForm, {
        action,
        products: [
          { id_producto: "PRO00000001", nombre_producto: "Puerta metalica", categoria: "puertas", unidad_medida: "unidad" },
        ],
        routes: [
          {
            id_ruta: "RUT00000001",
            id_producto: "PRO00000001",
            nombre_ruta: "Ruta puerta",
            producto_nombre: "Puerta metalica",
            etapas_activas: 2,
          },
        ],
        versions: [
          {
            id_version_receta: "VRE00000001",
            id_producto: "PRO00000001",
            nombre_receta: "Receta puerta",
            producto_nombre: "Puerta metalica",
            numero_version: "v1",
            materiales: 3,
          },
        ],
        orderDetails: [],
        campaigns: [],
        canCreateOrder: true,
        initialStartDate: "2026-11-20",
        returnTo: RETURN_TO,
        successNotification: NOTIFICATION,
      }),
    );
  });

  return received;
}

/** Elige una opcion como el usuario: abre la lista del campo y pulsa la opcion. */
async function choose(name: string, label: string) {
  await act(async () => {
    control<HTMLInputElement>(`#${name}`).focus();
  });

  const option = [...host.querySelectorAll<HTMLElement>('[role="option"]')].find((item) =>
    item.textContent?.includes(label),
  );

  if (!option) {
    throw new Error(`No hay opcion ${label} en ${name}`);
  }

  await act(async () => {
    option.click();
  });
}

/** Cambia un campo como el usuario: React necesita el evento para su onChange. */
async function type(name: string, value: string) {
  const element = control<HTMLInputElement>(`input[name="${name}"]`);

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function selectType(value: string) {
  const select = control<HTMLSelectElement>('select[name="tipo_produccion"]');

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

// Estas pruebas miran como el formulario trata la respuesta del servidor, no las reglas del
// navegador (required).
async function fillAndSubmit() {
  await selectType("reposicion_stock");
  await choose("id_producto", "Puerta metalica");
  await choose("id_ruta", "Ruta puerta");
  await choose("id_version_receta", "Receta puerta");
  await type("cantidad", "12.5");
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

describe("WorkOrderForm (C5 de la 11.6a)", () => {
  it("envia lo elegido y una clave guardada para la orden nueva", async () => {
    const received = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    const clave = String(received[0].get("clave_operacion"));

    expect(valuesOf(received[0])).toMatchObject({
      tipo_produccion: "reposicion_stock",
      id_producto: "PRO00000001",
      id_ruta: "RUT00000001",
      id_version_receta: "VRE00000001",
      cantidad: "12.5",
      fecha_inicio: "2026-11-20",
      prioridad: "media",
    });
    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(clave);
  });

  it("tras un error conserva lo elegido, marca el campo, guarda la clave y no da avisos", async () => {
    const message = "La ruta seleccionada no existe, está inactiva o no pertenece al producto.";

    const received = await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { id_ruta: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(control<HTMLSelectElement>('select[name="tipo_produccion"]').value).toBe("reposicion_stock");
    expect(control<HTMLInputElement>('input[type="hidden"][name="id_producto"]').value).toBe("PRO00000001");
    expect(control<HTMLInputElement>('input[type="hidden"][name="id_ruta"]').value).toBe("RUT00000001");
    expect(control<HTMLInputElement>('input[type="hidden"][name="id_version_receta"]').value).toBe("VRE00000001");
    expect(control<HTMLInputElement>('input[name="cantidad"]').value).toBe("12.5");
    expect(control<HTMLInputElement>("#id_ruta").getAttribute("aria-invalid")).toBe("true");
    // El mensaje queda en el aviso general del formulario y junto al campo.
    expect(control('[role="alert"]').textContent).toContain(message);
    expect(control("#id_ruta-error").textContent).toBe(message);
    // La clave sigue siendo la misma: el reenvio corregido es la misma operacion.
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(String(received[0].get("clave_operacion")));
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("tras guardar avisa una vez, renueva la clave y va al detalle de la orden creada", async () => {
    const received = await render((formData) => ({
      status: "success",
      data: { id_orden_trabajo: "OTR00000012", clave_operacion: String(formData.get("clave_operacion")) },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(NOTIFICATION);
    expect(router.push.mock.calls).toEqual([["/dashboard/production/work-orders/OTR00000012"]]);

    const stored = sessionStorage.getItem(STORAGE_KEY);

    expect(stored).toMatch(UUID);
    expect(stored).not.toBe(received[0].get("clave_operacion"));
  });

  it("Cancelar lleva al listado del que vino", async () => {
    await render((formData) => ({ status: "error", error: "x", values: valuesOf(formData), operationId: "op-1" }));

    const cancel = [...host.querySelectorAll<HTMLAnchorElement>("a")].find(
      (link) => link.textContent?.trim() === "Cancelar",
    );

    expect(cancel?.getAttribute("href")).toBe(RETURN_TO);
  });
});
