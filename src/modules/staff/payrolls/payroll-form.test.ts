// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PayrollFormState } from "@/modules/staff/payrolls/actions";
import { PayrollForm } from "@/modules/staff/payrolls/payroll-form";

// Formulario de generar planilla (C6 de la 11.5) con React real: la clave de la operacion, el
// operario elegido en SearchableSelect, lo que conserva tras un error (el operario, el periodo y
// el descuento, sin pagina de error) y lo que hace tras guardar (un aviso, clave nueva y vuelta al
// listado).

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETURN_TO = "/dashboard/staff/payrolls";
const NOTIFICATION = { type: "success", message: "Planilla generada correctamente" } as const;
const STORAGE_KEY = "clave-operacion:planilla:nueva";

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

const valuesOf = (formData: FormData) => ({
  id_operario: String(formData.get("id_operario") ?? ""),
  periodo_inicio: String(formData.get("periodo_inicio") ?? ""),
  periodo_fin: String(formData.get("periodo_fin") ?? ""),
  descuentos: String(formData.get("descuentos") ?? ""),
});

async function render(respond: (formData: FormData) => PayrollFormState) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: PayrollFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => {
    root.render(
      h(PayrollForm, {
        action,
        operators: [
          { id: "OPE00000003", label: "Quispe, Luis", description: "Semanal - Tarifa: S/ 50.00" },
          { id: "OPE00000004", label: "Mamani, Rosa", description: "Quincenal - Tarifa: S/ 60.00" },
        ],
        defaultStartDate: "2026-11-02",
        defaultEndDate: "2026-11-08",
        returnTo: RETURN_TO,
        successNotification: NOTIFICATION,
      }),
    );
  });

  return received;
}

/** Elige un operario como el usuario: abre la lista y pulsa la opcion. */
async function chooseOperator(label: string) {
  await act(async () => {
    control<HTMLInputElement>("#id_operario").focus();
  });

  const option = [...host.querySelectorAll<HTMLElement>('[role="option"]')].find((item) =>
    item.textContent?.includes(label),
  );

  if (!option) {
    throw new Error(`No hay opcion ${label}`);
  }

  await act(async () => {
    option.click();
  });
}

/** Cambia un campo como el usuario: React necesita el evento para su onChange. */
async function type(name: string, value: string) {
  const element = control<HTMLInputElement>(`[name="${name}"]`);

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// Estas pruebas miran como el formulario trata la respuesta del servidor, no las reglas del
// navegador (required).
async function fillAndSubmit() {
  await chooseOperator("Mamani, Rosa");
  await type("periodo_inicio", "2026-11-09");
  await type("descuentos", "10.005");
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

describe("PayrollForm", () => {
  it("propone el periodo, envia el operario elegido y una clave guardada", async () => {
    const received = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    expect(control<HTMLInputElement>('[name="periodo_inicio"]').value).toBe("2026-11-02");
    expect(control<HTMLInputElement>('[name="periodo_fin"]').value).toBe("2026-11-08");
    expect(control<HTMLInputElement>('[name="descuentos"]').value).toBe("0");

    await fillAndSubmit();

    const clave = String(received[0].get("clave_operacion"));

    expect(valuesOf(received[0])).toEqual({
      id_operario: "OPE00000004",
      periodo_inicio: "2026-11-09",
      periodo_fin: "2026-11-08",
      descuentos: "10.005",
    });
    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(clave);
  });

  it("tras un error conserva el operario, el periodo y el descuento, marca el campo y no da avisos", async () => {
    const message = "El operario seleccionado no existe o está inactivo.";

    const received = await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { id_operario: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(control<HTMLInputElement>('input[type="hidden"][name="id_operario"]').value).toBe("OPE00000004");
    expect(control<HTMLInputElement>("#id_operario").value).toBe("Mamani, Rosa");
    expect(control<HTMLInputElement>("#id_operario").getAttribute("aria-invalid")).toBe("true");
    expect(control<HTMLInputElement>('[name="periodo_inicio"]').value).toBe("2026-11-09");
    expect(control<HTMLInputElement>('[name="descuentos"]').value).toBe("10.005");
    expect(host.textContent).toContain(message);
    // La clave sigue siendo la misma: el reenvio corregido es la misma operacion.
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(String(received[0].get("clave_operacion")));
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("tras guardar avisa una vez, renueva la clave y vuelve al listado", async () => {
    const received = await render((formData) => ({
      status: "success",
      data: { id_planilla: "PLA00000012", clave_operacion: String(formData.get("clave_operacion")) },
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
