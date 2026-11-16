// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OperatorPaymentFormState } from "@/modules/staff/payment-history/actions";
import { OperatorPaymentForm } from "@/modules/staff/payment-history/operator-payment-form";

// Formulario del pago de planilla (C7 de la 11.5) con React real: la clave de la operacion, lo que
// conserva tras un error (la planilla, el monto y el metodo, sin pagina de error), que una
// planilla que ya no esta entre las opciones no deja elegida otra, y lo que hace tras guardar (un
// aviso, clave nueva y vuelta al historial).

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETURN_TO = "/dashboard/staff/payment-history";
const NOTIFICATION = { type: "success", message: "Pago a operario registrado correctamente" } as const;
const STORAGE_KEY = "clave-operacion:pago_planilla:nuevo";

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

function control<T extends HTMLElement>(name: string) {
  const element = host.querySelector<T>(`[name="${name}"]`);

  if (!element) {
    throw new Error(`No hay ningun campo ${name}`);
  }

  return element;
}

const valuesOf = (formData: FormData) => ({
  id_planilla: String(formData.get("id_planilla") ?? ""),
  fecha_pago: String(formData.get("fecha_pago") ?? ""),
  monto_pagado: String(formData.get("monto_pagado") ?? ""),
  metodo_pago: String(formData.get("metodo_pago") ?? ""),
  observaciones: String(formData.get("observaciones") ?? ""),
});

async function render(respond: (formData: FormData) => OperatorPaymentFormState) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: OperatorPaymentFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => {
    root.render(
      h(OperatorPaymentForm, {
        action,
        payrolls: [
          { value: "PLA00000009", label: "PLA00000009 · Quispe, Luis · Neto: S/ 90.00" },
          { value: "PLA00000010", label: "PLA00000010 · Mamani, Rosa · Neto: S/ 120.00" },
        ],
        defaultDate: "2026-11-09",
        returnTo: RETURN_TO,
        successNotification: NOTIFICATION,
      }),
    );
  });

  return received;
}

/** Cambia un campo como el usuario: React necesita el evento para su onChange. */
async function change(name: string, value: string) {
  const element = control<HTMLInputElement | HTMLSelectElement>(name);
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;

  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

// Estas pruebas miran como el formulario trata la respuesta del servidor, no las reglas del
// navegador (required).
async function fillAndSubmit() {
  await change("id_planilla", "PLA00000010");
  await change("monto_pagado", "120.01");
  await change("metodo_pago", "yape");
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

describe("OperatorPaymentForm", () => {
  it("empieza sin planilla elegida, propone la fecha y el efectivo, y envia una clave guardada", async () => {
    const received = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    expect(control<HTMLSelectElement>("id_planilla").value).toBe("");
    expect(control<HTMLInputElement>("fecha_pago").value).toBe("2026-11-09");
    expect(control<HTMLSelectElement>("metodo_pago").value).toBe("efectivo");

    await fillAndSubmit();

    const clave = String(received[0].get("clave_operacion"));

    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(clave);
  });

  it("tras un error conserva la planilla, el monto y el metodo, marca el campo y no da avisos", async () => {
    const message = "Para esta versión MVP, el monto pagado debe coincidir con el monto neto de la planilla.";

    const received = await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { monto_pagado: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(control<HTMLSelectElement>("id_planilla").value).toBe("PLA00000010");
    expect(control<HTMLInputElement>("monto_pagado").value).toBe("120.01");
    expect(control<HTMLSelectElement>("metodo_pago").value).toBe("yape");
    expect(control<HTMLInputElement>("monto_pagado").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(String(received[0].get("clave_operacion")));
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("una planilla que ya no esta entre las opciones no deja elegida otra", async () => {
    await render((formData) => ({
      status: "error",
      error: "La planilla seleccionada ya fue pagada.",
      fieldErrors: { id_planilla: ["La planilla seleccionada ya fue pagada."] },
      values: { ...valuesOf(formData), id_planilla: "PLA00000007" },
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(control<HTMLSelectElement>("id_planilla").value).toBe("");
  });

  it("tras guardar avisa una vez, renueva la clave y vuelve al historial", async () => {
    const received = await render((formData) => ({
      status: "success",
      data: { id_historial_pago: "HPO00000012", clave_operacion: String(formData.get("clave_operacion")) },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(NOTIFICATION);
    expect(router.push).toHaveBeenCalledWith(RETURN_TO);

    const stored = sessionStorage.getItem(STORAGE_KEY);

    expect(stored).toMatch(UUID);
    expect(stored).not.toBe(received[0].get("clave_operacion"));
  });
});
