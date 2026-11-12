// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { InventoryOutputFormState } from "@/modules/inventory/movements/actions";
import { InventoryOutputForm } from "@/modules/inventory/movements/inventory-output-form";

// Formulario de la salida de inventario (C2 de la 11.2c) con React real: la clave de la
// operacion, lo que conserva tras un error (el material y la orden elegidos, sin un segundo
// aviso de SweetAlert) y lo que hace tras guardar (un aviso, clave nueva y vuelta al listado).

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETURN_TO = "/dashboard/inventory/outputs?material=MAT00000006";
const NOTIFICATION = { type: "success", message: "Salida registrada correctamente" } as const;
const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

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
  id_material: String(formData.get("id_material") ?? ""),
  id_orden_trabajo: String(formData.get("id_orden_trabajo") ?? ""),
  cantidad: String(formData.get("cantidad") ?? ""),
  motivo: String(formData.get("motivo") ?? ""),
});

async function render(respond: (formData: FormData) => InventoryOutputFormState) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: InventoryOutputFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => {
    root.render(
      h(InventoryOutputForm, {
        action,
        materials: [
          { id: "MAT00000006", label: "Plancha LAC 2 mm (10.25 kg disponible)" },
          { id: "MAT00000007", label: "Tubo 2 pulgadas (4.00 m disponible)" },
        ],
        workOrders: [{ id: "OTR00000007", label: "OTR00000007 - en_proceso" }],
        returnTo: RETURN_TO,
        successNotification: NOTIFICATION,
      }),
    );
  });

  return received;
}

// Estas pruebas miran como el formulario trata la respuesta del servidor, no las reglas del
// navegador (required).
async function fillAndSubmit() {
  await act(async () => {
    control<HTMLSelectElement>("id_material").value = "MAT00000007";
    control<HTMLSelectElement>("id_orden_trabajo").value = "OTR00000007";
    control<HTMLInputElement>("cantidad").value = "9";
    control<HTMLTextAreaElement>("motivo").value = "Corte para soporte";
  });
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

describe("InventoryOutputForm", () => {
  it("envia una clave de operacion guardada para la salida nueva", async () => {
    const received = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    const clave = String(received[0].get("clave_operacion"));

    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem("clave-operacion:salida:nueva")).toBe(clave);
  });

  it("tras un error conserva lo elegido, marca el campo y no da un segundo aviso", async () => {
    const message = "No hay stock suficiente para registrar la salida.";

    await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { cantidad: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(control<HTMLSelectElement>("id_material").value).toBe("MAT00000007");
    expect(control<HTMLSelectElement>("id_orden_trabajo").value).toBe("OTR00000007");
    expect(control<HTMLInputElement>("cantidad").value).toBe("9");
    expect(control<HTMLInputElement>("cantidad").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("tras guardar avisa una vez, renueva la clave y vuelve al listado", async () => {
    const received = await render((formData) => ({
      status: "success",
      data: { id_movimiento: "MVI00000040", clave_operacion: String(formData.get("clave_operacion")) },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    // C1 de la 11.3b (hallazgo 8 de la 11.3a): el aviso exacto, con la nota de los filtros del
    // listado al que vuelve; contar la llamada no notaba un aviso vacio.
    expect(notifications.notify).toHaveBeenCalledWith({ ...NOTIFICATION, description: FILTER_HINT });
    expect(router.push).toHaveBeenCalledWith(RETURN_TO);

    const stored = sessionStorage.getItem("clave-operacion:salida:nueva");

    expect(stored).toMatch(UUID);
    expect(stored).not.toBe(received[0].get("clave_operacion"));
  });
});
