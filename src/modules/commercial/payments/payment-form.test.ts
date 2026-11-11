// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PaymentFormState } from "@/modules/commercial/payments/actions";
import { PaymentForm } from "@/modules/commercial/payments/payment-form";

// Seccion del pago de cliente en el detalle de la proforma (C5 de la 11.3a) con React real: la
// clave de la operacion por proforma, lo que conserva tras un error (el monto, el metodo y el
// tipo, sin pagina de error) y lo que hace tras guardar (un aviso, formulario vacio y clave
// nueva), tambien cuando ese pago deja la proforma pagada (hallazgo 9 de la 11.2a).

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUOTE = "PRF00000007";
const SCOPE = `clave-operacion:pago_cliente:${QUOTE}`;
const NOTIFICATION = { type: "success", message: "Pago registrado correctamente" } as const;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  sessionStorage.clear();
  notifications.notify.mockReset();
  notifications.showError.mockReset();
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
  monto_pagado: String(formData.get("monto_pagado") ?? ""),
  metodo_pago: String(formData.get("metodo_pago") ?? ""),
  tipo_pago: String(formData.get("tipo_pago") ?? ""),
  observaciones: String(formData.get("observaciones") ?? ""),
});

type Respond = (formData: FormData) => PaymentFormState;

function props(action: (prev: PaymentFormState, formData: FormData) => Promise<PaymentFormState>, isPaid = false) {
  return { action, quoteId: QUOTE, currentBalance: "100", isPaid, successNotification: NOTIFICATION };
}

async function render(respond: Respond) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: PaymentFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => root.render(h(PaymentForm, props(action))));

  return { received, action };
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

// Estas pruebas miran como la seccion trata la respuesta del servidor, no las reglas del
// navegador (max, required).
async function fillAndSubmit() {
  await change("monto_pagado", "120");
  await change("metodo_pago", "plin");
  await change("tipo_pago", "cancelacion");
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

const shownBalance = () =>
  [...host.querySelectorAll("span")].find((span) => span.textContent === "Saldo después del pago")?.nextElementSibling
    ?.textContent;

describe("PaymentForm", () => {
  it("envia la proforma y una clave guardada por proforma", async () => {
    const { received } = await render((formData) => ({ status: "error", error: "x", values: valuesOf(formData), operationId: "op-1" }));

    await fillAndSubmit();

    const clave = String(received[0].get("clave_operacion"));

    expect(received[0].get("id_proforma")).toBe(QUOTE);
    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem(SCOPE)).toBe(clave);
  });

  it("tras un error conserva el monto, el metodo y el tipo, marca el campo y no da avisos", async () => {
    const message = "El pago no puede ser mayor que el saldo pendiente: S/ 100.00.";
    const { received } = await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { monto_pagado: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(control<HTMLInputElement>("monto_pagado").value).toBe("120");
    expect(control<HTMLSelectElement>("metodo_pago").value).toBe("plin");
    expect(control<HTMLSelectElement>("tipo_pago").value).toBe("cancelacion");
    expect(control<HTMLInputElement>("monto_pagado").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(SCOPE)).toBe(received[0].get("clave_operacion"));
  });

  it("tras guardar avisa una vez, vacia el formulario y renueva la clave", async () => {
    const { received } = await render((formData) => ({
      status: "success",
      data: { id_pago_cliente: "PCL00000012", clave_operacion: String(formData.get("clave_operacion")) },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(NOTIFICATION);
    expect(control<HTMLInputElement>("monto_pagado").value).toBe("");
    expect(control<HTMLSelectElement>("metodo_pago").value).toBe("efectivo");
    expect(shownBalance()?.replace(/\s/g, "")).toBe("S/100.00");

    const stored = sessionStorage.getItem(SCOPE);

    expect(stored).toMatch(UUID);
    expect(stored).not.toBe(received[0].get("clave_operacion"));
  });

  it("el pago que salda la proforma da su aviso aunque la pagina llegue ya pagada", async () => {
    const { action } = await render((formData) => ({
      status: "success",
      data: { id_pago_cliente: "PCL00000013", clave_operacion: String(formData.get("clave_operacion")) },
      values: valuesOf(formData),
      operationId: "op-2",
    }));

    await fillAndSubmit();
    // La revalidacion repinta el detalle con la proforma pagada en el mismo render del exito.
    await act(async () => root.render(h(PaymentForm, props(action, true))));

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(NOTIFICATION);
    expect(control<HTMLInputElement>("monto_pagado").disabled).toBe(true);
    expect(host.textContent).toContain("Esta proforma ya está pagada.");
  });
});
