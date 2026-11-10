// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PurchaseForm } from "@/components/inventory/purchase-form";

// Vista previa de los montos del formulario de compra (11.2b, C2), con React real: usa la
// misma funcion que guarda la accion (purchase-amounts.ts), asi que lo que se ve antes de
// guardar es lo que se guarda.

vi.mock("@/modules/inventory/purchases/actions", () => ({ createPurchaseAction: vi.fn() }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverDouble {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

/** Escribe en un campo controlado como lo haria el teclado: React escucha el evento input. */
async function typeInto(name: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[name="${name}"]`);

  if (!input) {
    throw new Error(`No hay ningun campo ${name}`);
  }

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function totals() {
  const summary = [...host.querySelectorAll("span")].map((span) => span.textContent?.trim() ?? "");
  const after = (label: string) => summary[summary.findIndex((text) => text.startsWith(label)) + 1];

  return { subtotal: after("Subtotal calculado"), igv: after("IGV"), total: after("Total de la compra") };
}

describe("PurchaseForm: vista previa de los montos", () => {
  it("con IGV muestra subtotal, IGV y total como los guarda la accion", async () => {
    await act(async () => {
      root.render(h(PurchaseForm, { suppliers: [], materials: [] }));
    });

    await typeInto("cantidad", "1.25");
    await typeInto("costo_unitario", "10.25");

    expect(totals()).toEqual({ subtotal: "S/ 12.81", igv: "S/ 0.00", total: "S/ 12.81" });

    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[role="switch"]')?.click();
    });

    expect(totals()).toEqual({ subtotal: "S/ 12.81", igv: "S/ 2.31", total: "S/ 15.12" });
  });

  it("el subtotal de la linea sale de la cantidad redondeada: 1.005 x 10 es 10.10", async () => {
    await act(async () => {
      root.render(h(PurchaseForm, { suppliers: [], materials: [] }));
    });

    await typeInto("cantidad", "1.005");
    await typeInto("costo_unitario", "10");

    expect(totals().subtotal).toBe("S/ 10.10");
    expect(host.textContent).toContain("S/ 10.10");
  });
});
