// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PettyCashIncomeAdjustmentFormState } from "@/modules/petty-cash/income-adjustments/actions";
import { PettyCashIncomeAdjustmentForm } from "@/modules/petty-cash/income-adjustments/income-adjustment-form";

// Formulario del ingreso o ajuste de caja chica (C6 de la 11.4a) con React real: la clave de la
// operacion, lo que conserva tras un error (la caja, el tipo y el monto, sin pagina de error) y lo
// que hace tras guardar (un aviso, clave nueva y vuelta a caja chica).

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETURN_TO = "/dashboard/petty-cash";
const NOTIFICATION = { type: "success", message: "Ingreso de caja registrado correctamente" } as const;
const STORAGE_KEY = "clave-operacion:movimiento_caja:nuevo";

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
  id_caja_chica: String(formData.get("id_caja_chica") ?? ""),
  tipo_operacion: String(formData.get("tipo_operacion") ?? ""),
  concepto: String(formData.get("concepto") ?? ""),
  monto: String(formData.get("monto") ?? ""),
  fecha_movimiento: String(formData.get("fecha_movimiento") ?? ""),
  comprobante: String(formData.get("comprobante") ?? ""),
  responsable: String(formData.get("responsable") ?? ""),
  observaciones: String(formData.get("observaciones") ?? ""),
});

async function render(respond: (formData: FormData) => PettyCashIncomeAdjustmentFormState) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: PettyCashIncomeAdjustmentFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => {
    root.render(
      h(PettyCashIncomeAdjustmentForm, {
        action,
        boxes: [
          { id_caja_chica: "CAJ00000001", nombre_caja: "Caja oficina", saldo_actual: "20.00" },
          { id_caja_chica: "CAJ00000002", nombre_caja: "Caja taller", saldo_actual: "100.00" },
        ],
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
  await change("id_caja_chica", "CAJ00000002");
  await change("tipo_operacion", "ajuste_disminucion");
  await change("concepto", "Faltante de arqueo");
  await change("monto", "120.50");
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

describe("PettyCashIncomeAdjustmentForm", () => {
  it("propone la fecha que da la pagina y el ingreso, y envia una clave de operacion guardada", async () => {
    const received = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    expect(control<HTMLInputElement>("fecha_movimiento").value).toBe("2026-11-12");
    expect(control<HTMLSelectElement>("tipo_operacion").value).toBe("ingreso");

    await fillAndSubmit();

    const clave = String(received[0].get("clave_operacion"));

    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(clave);
  });

  it("tras un error conserva la caja, el tipo y el monto, marca el campo, guarda la clave y no da avisos", async () => {
    const message = "El ajuste negativo supera el saldo disponible de la caja. Saldo actual: S/ 100.00.";

    const received = await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { monto: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(control<HTMLSelectElement>("id_caja_chica").value).toBe("CAJ00000002");
    expect(control<HTMLSelectElement>("tipo_operacion").value).toBe("ajuste_disminucion");
    expect(control<HTMLInputElement>("monto").value).toBe("120.50");
    expect(control<HTMLInputElement>("monto").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
    // La clave sigue siendo la misma: el reenvio corregido es la misma operacion.
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(String(received[0].get("clave_operacion")));
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("tras guardar avisa una vez, renueva la clave y vuelve a caja chica", async () => {
    const received = await render((formData) => ({
      status: "success",
      data: { id_movimiento_caja: "MCA00000012", clave_operacion: String(formData.get("clave_operacion")) },
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
