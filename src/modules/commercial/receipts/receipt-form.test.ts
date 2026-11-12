// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReceiptFormState } from "@/modules/commercial/receipts/actions";
import { ReceiptForm } from "@/modules/commercial/receipts/receipt-form";

// Seccion del comprobante en el detalle de la proforma (C6 de la 11.3b) con React real: la clave
// por proforma, el numero sugerido (solo en el navegador, despues de montar: el servidor no lo
// calcula y la hidratacion no ve otra hora), lo que conserva tras un error y lo que hace tras
// emitir, tambien cuando el detalle llega ya con el comprobante.

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUOTE = "PRF00000007";
const SCOPE = `clave-operacion:comprobante:${QUOTE}`;
const NOTIFICATION = { type: "success", message: "Comprobante registrado correctamente" } as const;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 11, 9, 5));
  sessionStorage.clear();
  notifications.notify.mockReset();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host.remove();
  vi.useRealTimers();
});

function control<T extends HTMLElement>(name: string) {
  const element = host.querySelector<T>(`[name="${name}"]`);

  if (!element) {
    throw new Error(`No hay ningun campo ${name}`);
  }

  return element;
}

const valuesOf = (formData: FormData) => ({
  tipo_comprobante: String(formData.get("tipo_comprobante") ?? ""),
  numero_comprobante: String(formData.get("numero_comprobante") ?? ""),
  monto_total: String(formData.get("monto_total") ?? ""),
  observaciones: String(formData.get("observaciones") ?? ""),
});

type Action = (prev: ReceiptFormState, formData: FormData) => Promise<ReceiptFormState>;

const props = (action: Action, hasReceipt = false) => ({
  action,
  quoteId: QUOTE,
  suggestedAmount: "150.5",
  hasReceipt,
  successNotification: NOTIFICATION,
});

async function render(respond: (formData: FormData) => ReceiptFormState) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: ReceiptFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  root = createRoot(host);
  await act(async () => root.render(h(ReceiptForm, props(action))));

  return { received, action };
}

async function changeSelect(name: string, value: string) {
  const element = control<HTMLSelectElement>(name);

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
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

describe("ReceiptForm", () => {
  it("el servidor no sugiere numero y el navegador lo escribe al hidratar, sin desajuste", async () => {
    const action = vi.fn();
    const serverHtml = renderToString(h(ReceiptForm, props(action)));
    const errors: unknown[] = [];

    expect(serverHtml).not.toMatch(/B001-/);

    host.innerHTML = serverHtml;
    await act(async () => {
      root = hydrateRoot(host, h(ReceiptForm, props(action)), { onRecoverableError: (error) => errors.push(error) });
    });

    expect(errors).toEqual([]);
    expect(control<HTMLInputElement>("numero_comprobante").value).toBe("B001-202611110905");
  });

  it("cambiar el tipo cambia el prefijo del numero sugerido", async () => {
    await render((formData) => ({ status: "error", error: "x", values: valuesOf(formData), operationId: "op-1" }));
    await changeSelect("tipo_comprobante", "factura");

    expect(control<HTMLInputElement>("numero_comprobante").value).toBe("F001-202611110905");
  });

  it("envia la proforma, el monto sugerido y una clave guardada por proforma", async () => {
    const { received } = await render((formData) => ({ status: "error", error: "x", values: valuesOf(formData), operationId: "op-1" }));

    await submit();

    const clave = String(received[0].get("clave_operacion"));

    expect([received[0].get("id_proforma"), received[0].get("monto_total")]).toEqual([QUOTE, "150.50"]);
    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem(SCOPE)).toBe(clave);
  });

  it("tras un numero repetido conserva lo escrito, marca el campo y no da avisos", async () => {
    const message = "Ya existe un comprobante con ese número.";

    await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { numero_comprobante: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    await changeSelect("tipo_comprobante", "factura");
    await act(async () => {
      control<HTMLInputElement>("numero_comprobante").value = "F001-000045";
    });
    await submit();

    expect(control<HTMLSelectElement>("tipo_comprobante").value).toBe("factura");
    expect(control<HTMLInputElement>("numero_comprobante").value).toBe("F001-000045");
    expect(control<HTMLInputElement>("numero_comprobante").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("el comprobante emitido da su aviso aunque el detalle llegue ya con el comprobante", async () => {
    const { received, action } = await render((formData) => ({
      status: "success",
      data: { id_comprobante: "CMP00000012", clave_operacion: String(formData.get("clave_operacion")) },
      values: valuesOf(formData),
      operationId: "op-2",
    }));

    await submit();
    await act(async () => root.render(h(ReceiptForm, props(action, true))));

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(NOTIFICATION);
    expect(control<HTMLInputElement>("numero_comprobante").disabled).toBe(true);
    expect(host.textContent).toContain("Esta proforma ya tiene un comprobante emitido.");

    const stored = sessionStorage.getItem(SCOPE);

    expect(stored).toMatch(UUID);
    expect(stored).not.toBe(received[0].get("clave_operacion"));
  });
});
