// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { QuoteFormState } from "@/modules/commercial/quotes/actions";
import { QuoteForm, type QuoteOrderOption } from "@/modules/commercial/quotes/quote-form";

// Formulario de la proforma nueva (C4 de la 11.3a) con React real: la clave de la operacion, lo
// que conserva tras un error (el pedido elegido, el adelanto y su metodo, sin pagina de error) y
// lo que hace tras guardar (un aviso, clave nueva y vuelta al listado).

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETURN_TO = "/dashboard/commercial/quotes?status=vigente";
const NOTIFICATION = { type: "success", message: "Proforma creada correctamente" } as const;
const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

const order = (id_pedido: string, monto_total: string): QuoteOrderOption => ({
  id_pedido,
  cliente: "Constructora de prueba",
  fecha_pedido: "2026-07-15T15:00:00.000Z",
  fecha_entrega_estimada: null,
  monto_total,
  productos: [],
});

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
  id_pedido: String(formData.get("id_pedido") ?? ""),
  adelanto_inicial: String(formData.get("adelanto_inicial") ?? ""),
  metodo_pago_adelanto: String(formData.get("metodo_pago_adelanto") ?? ""),
  validez_dias: String(formData.get("validez_dias") ?? ""),
  observaciones: String(formData.get("observaciones") ?? ""),
});

async function render(respond: (formData: FormData) => QuoteFormState) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: QuoteFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => {
    root.render(
      h(QuoteForm, {
        action,
        orders: [order("PED00000004", "300.30"), order("PED00000005", "80.00")],
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
  await change("id_pedido", "PED00000005");
  await change("adelanto_inicial", "20");
  await change("metodo_pago_adelanto", "plin");
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

describe("QuoteForm", () => {
  it("envia una clave de operacion guardada para la proforma nueva", async () => {
    const received = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    const clave = String(received[0].get("clave_operacion"));

    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem("clave-operacion:proforma:nueva")).toBe(clave);
  });

  it("tras un error conserva el pedido, el adelanto y su metodo, marca el campo y no da avisos", async () => {
    const message = "El adelanto inicial no puede ser mayor que el monto total.";

    await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { adelanto_inicial: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(control<HTMLSelectElement>("id_pedido").value).toBe("PED00000005");
    expect(control<HTMLInputElement>("adelanto_inicial").value).toBe("20");
    expect(control<HTMLSelectElement>("metodo_pago_adelanto").value).toBe("plin");
    expect(control<HTMLInputElement>("adelanto_inicial").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("tras guardar avisa una vez, renueva la clave y vuelve al listado", async () => {
    const received = await render((formData) => ({
      status: "success",
      data: { id_proforma: "PRF00000012", clave_operacion: String(formData.get("clave_operacion")) },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    // C1 de la 11.3b (hallazgo 8 de la 11.3a): el aviso exacto, con la nota de los filtros del
    // listado al que vuelve; contar la llamada no notaba un aviso vacio.
    expect(notifications.notify).toHaveBeenCalledWith({ ...NOTIFICATION, description: FILTER_HINT });
    expect(router.push).toHaveBeenCalledWith(RETURN_TO);

    const stored = sessionStorage.getItem("clave-operacion:proforma:nueva");

    expect(stored).toMatch(UUID);
    expect(stored).not.toBe(received[0].get("clave_operacion"));
  });
});
