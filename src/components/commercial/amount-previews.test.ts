// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PaymentForm } from "@/modules/commercial/payments/payment-form";
import { QuoteForm } from "@/modules/commercial/quotes/quote-form";

// Vistas previas del saldo en los formularios de proforma y de pago (C2 de la 11.3a): usan la
// misma regla en centimos que la accion (client-payment-amounts.ts), asi que muestran el saldo
// que se guardara. Con number, 0.125 sobre 10.00 mostraba 9.88 y la accion guarda 9.87.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

async function type(name: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`[name="${name}"]`);

  if (!input) {
    throw new Error(`No hay ningun campo ${name}`);
  }

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** El monto que se muestra junto a una etiqueta, sin espacios. */
function shownAfter(label: string) {
  const element = [...host.querySelectorAll("span, label, p")].find((item) => item.textContent?.trim() === label);
  const value = element?.nextElementSibling?.textContent ?? element?.parentElement?.nextElementSibling?.textContent;

  return value?.replace(/\s/g, "");
}

describe("vista previa del pago de cliente", () => {
  const paymentProps = {
    action: vi.fn(),
    quoteId: "PRF00000007",
    currentBalance: "10",
    isPaid: false,
    successNotification: { type: "success", message: "Pago registrado correctamente" } as const,
  };

  it("0.125 sobre 10.00 deja 9.87, como guarda la accion", async () => {
    await act(async () => root.render(h(PaymentForm, { ...paymentProps })));
    await type("monto_pagado", "0.125");

    expect(shownAfter("Saldo después del pago")).toBe("S/9.87");
  });

  it("un pago mayor que el saldo muestra cero", async () => {
    await act(async () => root.render(h(PaymentForm, { ...paymentProps })));
    await type("monto_pagado", "10.005");

    expect(shownAfter("Saldo después del pago")).toBe("S/0.00");
  });
});

describe("vista previa de la proforma", () => {
  const order = {
    id_pedido: "PED00000004",
    cliente: "Cliente de prueba",
    fecha_pedido: "2026-07-15T15:00:00.000Z",
    fecha_entrega_estimada: null,
    monto_total: "10.00",
    productos: [],
  };

  async function renderQuote() {
    await act(async () =>
      root.render(
        h(QuoteForm, {
          action: vi.fn(),
          orders: [order],
          defaultOrderId: order.id_pedido,
          successNotification: { type: "success", message: "Proforma creada correctamente" },
          returnTo: "/dashboard/commercial/quotes",
        }),
      ),
    );
  }

  const balance = () => shownAfter("Saldo calculado");

  it("0.125 sobre 10.00 deja 9.87 y pide el metodo de pago", async () => {
    await renderQuote();
    await type("adelanto_inicial", "0.125");

    expect(balance()).toBe("S/9.87");
    expect(host.querySelector<HTMLSelectElement>("[name=metodo_pago_adelanto]")?.disabled).toBe(false);
  });

  it("un adelanto que se guardaria como 0.00 no pide metodo de pago", async () => {
    await renderQuote();
    await type("adelanto_inicial", "0.004");

    expect(host.querySelector<HTMLSelectElement>("[name=metodo_pago_adelanto]")?.disabled).toBe(true);
  });

  it("un adelanto mayor que el total muestra saldo cero", async () => {
    await renderQuote();
    await type("adelanto_inicial", "10.01");

    expect(balance()).toBe("S/0.00");
  });
});
