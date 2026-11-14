// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ScrapSaleFormState } from "@/modules/waste-scrap/scrap-sales/actions";
import { ScrapSaleForm } from "@/modules/waste-scrap/scrap-sales/scrap-sale-form";

// Formulario de la venta de chatarra (C4 de la 11.4b) con React real: la clave de la operacion, la
// chatarra que llega elegida con su peso y su cantidad, lo que conserva tras un error (la chatarra,
// la caja y el peso, sin pagina de error) y lo que hace tras guardar (un aviso, clave nueva y
// vuelta al listado de chatarra).

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETURN_TO = "/dashboard/waste-scrap/scraps";
const NOTIFICATION = { type: "success", message: "Venta de chatarra registrada correctamente" } as const;
const STORAGE_KEY = "clave-operacion:venta_chatarra:nueva";

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
  id_chatarra: String(formData.get("id_chatarra") ?? ""),
  id_caja_chica: String(formData.get("id_caja_chica") ?? ""),
  fecha_venta: String(formData.get("fecha_venta") ?? ""),
  cantidad_vendida: String(formData.get("cantidad_vendida") ?? ""),
  peso_vendido_kg: String(formData.get("peso_vendido_kg") ?? ""),
  monto_recibido: String(formData.get("monto_recibido") ?? ""),
  destino_dinero: String(formData.get("destino_dinero") ?? ""),
  observaciones: String(formData.get("observaciones") ?? ""),
});

async function render(respond: (formData: FormData) => ScrapSaleFormState) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: ScrapSaleFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => {
    root.render(
      h(ScrapSaleForm, {
        action,
        scraps: [
          { value: "CHA00000003", label: "CHA00000003 | Viruta | Peso: 4.00 kg | Cantidad: -" },
          { value: "CHA00000004", label: "CHA00000004 | Retazos | Peso: 15.00 kg | Cantidad: 3.00" },
        ],
        cashBoxes: [
          { value: "CAJ00000001", label: "Caja oficina | Saldo: S/ 20.00" },
          { value: "CAJ00000002", label: "Caja taller | Saldo: S/ 100.00" },
        ],
        defaultScrapId: "CHA00000004",
        defaultWeight: "15.00",
        defaultQuantity: "3.00",
        defaultDate: "2026-11-12",
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
  await change("id_chatarra", "CHA00000003");
  await change("id_caja_chica", "CAJ00000002");
  await change("peso_vendido_kg", "16.00");
  await change("monto_recibido", "80.25");
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

describe("ScrapSaleForm", () => {
  it("propone la chatarra elegida, su peso, su cantidad y la fecha, y envia una clave guardada", async () => {
    const received = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    expect(control<HTMLSelectElement>("id_chatarra").value).toBe("CHA00000004");
    expect(control<HTMLInputElement>("peso_vendido_kg").value).toBe("15.00");
    expect(control<HTMLInputElement>("cantidad_vendida").value).toBe("3.00");
    expect(control<HTMLInputElement>("fecha_venta").value).toBe("2026-11-12");

    await fillAndSubmit();

    const clave = String(received[0].get("clave_operacion"));

    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(clave);
  });

  it("tras un error conserva la chatarra, la caja y el peso, marca el campo, guarda la clave y no da avisos", async () => {
    const message = "El peso vendido no puede superar el peso registrado.";

    const received = await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { peso_vendido_kg: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    // La chatarra elegida en el formulario, no la que llego propuesta desde el listado.
    expect(control<HTMLSelectElement>("id_chatarra").value).toBe("CHA00000003");
    expect(control<HTMLSelectElement>("id_caja_chica").value).toBe("CAJ00000002");
    expect(control<HTMLInputElement>("peso_vendido_kg").value).toBe("16.00");
    expect(control<HTMLInputElement>("monto_recibido").value).toBe("80.25");
    expect(control<HTMLInputElement>("peso_vendido_kg").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
    // La clave sigue siendo la misma: el reenvio corregido es la misma operacion.
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(String(received[0].get("clave_operacion")));
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("tras guardar avisa una vez, renueva la clave y vuelve al listado de chatarra", async () => {
    const received = await render((formData) => ({
      status: "success",
      data: { id_venta_chatarra: "VCH00000012", clave_operacion: String(formData.get("clave_operacion")) },
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
