// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SupplierPaymentFormState } from "@/modules/inventory/supplier-payments/actions";
import { SupplierPaymentForm } from "@/modules/inventory/supplier-payments/supplier-payment-form";

// Formulario del pago a proveedor (C4 de la 11.2a) con React real: la clave
// de la operacion que envia, lo que conserva tras un error y lo que cambia tras
// un exito. La accion es un doble que devuelve el estado de cada caso.

const notifications = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COMPRA = "COM00000003";
const NOTIFICATION = { type: "success", message: "Pago a proveedor registrado correctamente" } as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  sessionStorage.clear();
  notifications.notify.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function input(name: string) {
  const element = host.querySelector<HTMLInputElement>(`[name="${name}"]`);

  if (!element) {
    throw new Error(`No hay ningun campo ${name}`);
  }

  return element;
}

/** Envia el formulario como lo haria el boton. */
async function submit() {
  await act(async () => host.querySelector("form")?.requestSubmit());
}

async function render(respond: (formData: FormData) => SupplierPaymentFormState) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: SupplierPaymentFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => {
    root.render(
      h(SupplierPaymentForm, {
        action,
        idCompra: COMPRA,
        saldoPendiente: "60.00",
        successNotification: NOTIFICATION,
      }),
    );
  });

  return received;
}

const valuesOf = (formData: FormData) => ({
  fecha_pago: String(formData.get("fecha_pago")),
  monto_pagado: String(formData.get("monto_pagado")),
  metodo_pago: String(formData.get("metodo_pago")),
  observaciones: String(formData.get("observaciones")),
});

async function fill() {
  await act(async () => {
    input("fecha_pago").value = "2026-07-14";
    input("monto_pagado").value = "40";
    (input("metodo_pago") as unknown as HTMLSelectElement).value = "efectivo";
  });
}

describe("SupplierPaymentForm", () => {
  it("envia la compra y una clave de operacion guardada para esa compra", async () => {
    const received = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fill();
    await submit();

    const clave = String(received[0].get("clave_operacion"));

    expect(received[0].get("id_compra")).toBe(COMPRA);
    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem(`clave-operacion:pago_proveedor:${COMPRA}`)).toBe(clave);
  });

  it("tras un error conserva lo escrito y la misma clave, y no avisa", async () => {
    let call = 0;
    const received = await render((formData) => ({
      status: "error",
      error: "El pago no puede superar el saldo pendiente. Saldo actual: S/ 60.00",
      fieldErrors: { monto_pagado: ["El pago no puede superar el saldo pendiente. Saldo actual: S/ 60.00"] },
      values: valuesOf(formData),
      operationId: `op-${++call}`,
    }));

    await fill();
    await submit();
    await submit();

    expect(received[1].get("clave_operacion")).toBe(received[0].get("clave_operacion"));
    expect(input("monto_pagado").value).toBe("40");
    expect(input("monto_pagado").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain("Saldo actual: S/ 60.00");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("tras un exito avisa una vez, vacia los campos y envia otra clave", async () => {
    let call = 0;
    const received = await render((formData) => ({
      status: "success",
      data: {
        id_pago_proveedor: `PPR0000000${++call}`,
        clave_operacion: String(formData.get("clave_operacion")),
      },
      values: valuesOf(formData),
      operationId: `op-${call}`,
    }));

    await fill();
    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(NOTIFICATION);
    expect(input("monto_pagado").value).toBe("");

    await fill();
    await submit();

    expect(received[1].get("clave_operacion")).toMatch(UUID);
    expect(received[1].get("clave_operacion")).not.toBe(received[0].get("clave_operacion"));
  });
});
