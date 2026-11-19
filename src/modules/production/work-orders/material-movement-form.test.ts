// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AdditionalDeliveryFormState,
  MaterialReturnFormState,
} from "@/modules/production/work-orders/actions";
import { MaterialMovementForm } from "@/modules/production/work-orders/material-movement-form";

// Entrega adicional y devolucion en el detalle de la orden (C1 de la 11.6b, D73) con React real:
// cada operacion envia su propia clave, guardada por orden; tras un error conserva el material,
// la cantidad y el motivo, marca el campo y no da avisos; tras guardar da un solo aviso, renueva
// la clave, limpia la cantidad y el motivo y no navega: el detalle se repinta con la revalidacion.

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OT = "OTR00000007";
const ADDITIONAL_KEY = `clave-operacion:entrega_adicional:${OT}`;
const RETURN_KEY = `clave-operacion:devolucion_material:${OT}`;
const ADDITIONAL_NOTIFICATION = { type: "success", message: "Entrega adicional registrada" } as const;
const RETURN_NOTIFICATION = { type: "success", message: "Devolución registrada" } as const;

type State = AdditionalDeliveryFormState | MaterialReturnFormState;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  sessionStorage.clear();
  notifications.notify.mockReset();
  notifications.showError.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
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

const valuesOf = (formData: FormData) => ({
  id_requerimiento: String(formData.get("id_requerimiento") ?? ""),
  cantidad: String(formData.get("cantidad") ?? ""),
  motivo: String(formData.get("motivo") ?? ""),
});

async function render(respond: (formData: FormData) => State) {
  const received: { operacion: string; formData: FormData }[] = [];
  const action = (operacion: string) =>
    vi.fn(async (_prev: State, formData: FormData) => {
      received.push({ operacion, formData });
      return respond(formData);
    });

  await act(async () => {
    root.render(
      h(MaterialMovementForm, {
        idOrdenTrabajo: OT,
        options: [
          { idRequerimiento: "ROM00000001", materialName: "Plancha LAC 2 mm", unidad: "kg", stockActual: 40, returnable: 10 },
          { idRequerimiento: "ROM00000002", materialName: "Soldadura", unidad: "kg", stockActual: 8, returnable: 3 },
        ],
        additionalAction: action("adicional"),
        returnAction: action("devolucion"),
        additionalNotification: ADDITIONAL_NOTIFICATION,
        returnNotification: RETURN_NOTIFICATION,
      }),
    );
  });

  return received;
}

/** Cambia un campo como el usuario: React necesita el evento para su onChange. */
async function type(selector: string, value: string) {
  const element = control<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector);
  const prototype = Object.getPrototypeOf(element) as object;

  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

async function fillAndSubmit() {
  await type('select[name="id_requerimiento"]', "ROM00000002");
  await type('input[name="cantidad"]', "2.5");
  await type('textarea[name="motivo"]', "Se rompio una pieza al soldar");
  await submit();
}

const errorWith = (field: string, message: string) => (formData: FormData): State => ({
  status: "error",
  error: message,
  fieldErrors: { [field]: [message] },
  values: valuesOf(formData),
  operationId: `op-${Math.random()}`,
});

const success = (formData: FormData): State => ({
  status: "success",
  data: { id_orden_trabajo: OT, id_movimiento: "MVI00000012", clave_operacion: String(formData.get("clave_operacion")) },
  values: valuesOf(formData),
  operationId: "op-1",
});

describe("MaterialMovementForm (C1 de la 11.6b)", () => {
  it("la entrega adicional envia la orden, lo elegido y su clave guardada por orden", async () => {
    const received = await render(errorWith("cantidad", "x"));

    await fillAndSubmit();

    expect(received.map((item) => item.operacion)).toEqual(["adicional"]);
    expect(received[0].formData.get("id_orden_trabajo")).toBe(OT);
    expect(valuesOf(received[0].formData)).toEqual({
      id_requerimiento: "ROM00000002",
      cantidad: "2.5",
      motivo: "Se rompio una pieza al soldar",
    });

    const clave = String(received[0].formData.get("clave_operacion"));

    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem(ADDITIONAL_KEY)).toBe(clave);
  });

  it("la devolucion va a su accion con su propia clave", async () => {
    const received = await render(errorWith("cantidad", "x"));

    await type('select[name="movimiento_modo"], #movimiento_modo', "devolucion");
    await fillAndSubmit();

    const clave = String(received[0].formData.get("clave_operacion"));

    expect(received.map((item) => item.operacion)).toEqual(["devolucion"]);
    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem(RETURN_KEY)).toBe(clave);
    expect(sessionStorage.getItem(ADDITIONAL_KEY)).not.toBe(clave);
  });

  it("tras un error conserva lo escrito, marca el campo, guarda la clave y no da avisos", async () => {
    const message = "Stock insuficiente para Soldadura: se piden 2.50 y hay 1.00.";
    const received = await render(errorWith("cantidad", message));

    await fillAndSubmit();

    expect(control<HTMLSelectElement>('select[name="id_requerimiento"]').value).toBe("ROM00000002");
    expect(control<HTMLInputElement>('input[name="cantidad"]').value).toBe("2.5");
    expect(control<HTMLTextAreaElement>('textarea[name="motivo"]').value).toBe("Se rompio una pieza al soldar");
    expect(control('input[name="cantidad"]').getAttribute("aria-invalid")).toBe("true");
    // C2 de la 11.7d2 (D111): el mensaje queda bajo su campo y la alerta no lo repite.
    expect(control('[role="alert"]')?.textContent).toBe("Revisa los campos marcados.");
    expect(document.body.textContent).toContain(message);
    expect(sessionStorage.getItem(ADDITIONAL_KEY)).toBe(String(received[0].formData.get("clave_operacion")));
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("tras guardar avisa una vez, renueva la clave, limpia la cantidad y el motivo y no navega", async () => {
    const received = await render(success);

    await fillAndSubmit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(ADDITIONAL_NOTIFICATION);
    expect(router.push).not.toHaveBeenCalled();
    expect(control<HTMLInputElement>('input[name="cantidad"]').value).toBe("");
    expect(control<HTMLTextAreaElement>('textarea[name="motivo"]').value).toBe("");

    const stored = sessionStorage.getItem(ADDITIONAL_KEY);

    expect(stored).toMatch(UUID);
    expect(stored).not.toBe(received[0].formData.get("clave_operacion"));
  });

  it("la devolucion avisa con su propio mensaje", async () => {
    await render(success);

    await type("#movimiento_modo", "devolucion");
    await fillAndSubmit();

    expect(notifications.notify).toHaveBeenCalledWith(RETURN_NOTIFICATION);
  });
});
