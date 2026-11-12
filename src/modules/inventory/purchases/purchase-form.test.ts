// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PurchaseFormState } from "@/modules/inventory/purchases/actions";
import { PurchaseForm } from "@/modules/inventory/purchases/purchase-form";

// Formulario de crear compra (11.2b) con React real: la vista previa de los montos (C2), la
// clave de operacion, lo que conserva tras un error (las lineas y el campo marcado de su
// linea) y lo que hace tras guardar (un aviso, clave nueva y vuelta al listado).

const notifications = vi.hoisted(() => ({ notify: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverDouble {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETURN_TO = "/dashboard/inventory/purchases?payment=pendiente";
const NOTIFICATION = { type: "success", message: "Compra registrada correctamente" } as const;
const FILTER_HINT = "Puede no aparecer con los filtros activos del listado.";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
  sessionStorage.clear();
  notifications.notify.mockReset();
  router.push.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function inputs(name: string) {
  return [...host.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
}

/** Escribe en un campo como lo haria el teclado: React escucha el evento input. */
async function typeInto(input: HTMLInputElement | undefined, value: string) {
  if (!input) {
    throw new Error("No hay campo");
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

function buttonWith(text: string) {
  const button = [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === text,
  );

  if (!button) {
    throw new Error(`No hay boton "${text}"`);
  }

  return button;
}

async function render(respond: (formData: FormData) => PurchaseFormState = errorFor) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: PurchaseFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => {
    root.render(
      h(PurchaseForm, {
        action,
        suppliers: [],
        materials: [],
        returnTo: RETURN_TO,
        successNotification: NOTIFICATION,
      }),
    );
  });

  return received;
}

const valuesOf = (formData: FormData) => ({
  id_proveedor: String(formData.get("id_proveedor") ?? ""),
  fecha_compra: String(formData.get("fecha_compra") ?? ""),
  tipo_comprobante: String(formData.get("tipo_comprobante") ?? ""),
  numero_comprobante: String(formData.get("numero_comprobante") ?? ""),
  aplica_igv: formData.get("aplica_igv") === "on",
  observaciones: String(formData.get("observaciones") ?? ""),
  items: formData.getAll("id_material").map((id_material, index) => ({
    id_material: String(id_material),
    cantidad: String(formData.getAll("cantidad")[index] ?? ""),
    unidad_medida: String(formData.getAll("unidad_medida")[index] ?? ""),
    costo_unitario: String(formData.getAll("costo_unitario")[index] ?? ""),
    observaciones: String(formData.getAll("item_observaciones")[index] ?? ""),
  })),
});

function errorFor(formData: FormData): PurchaseFormState {
  return {
    status: "error",
    error: "Revisa los datos de la compra.",
    fieldErrors: { "items.1.cantidad": ["La cantidad debe ser mayor que cero."] },
    values: valuesOf(formData),
    operationId: `op-${Math.random()}`,
  };
}

// Estas pruebas miran como el formulario trata la respuesta del servidor; las reglas del
// navegador (required, el proveedor elegido de SearchableSelect) detendrian el envio de un
// formulario vacio antes de llegar a la accion.
async function submit() {
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

describe("PurchaseForm: vista previa de los montos", () => {
  it("con IGV muestra subtotal, IGV y total como los guarda la accion", async () => {
    await render();

    await typeInto(inputs("cantidad")[0], "1.25");
    await typeInto(inputs("costo_unitario")[0], "10.25");

    expect(totals()).toEqual({ subtotal: "S/ 12.81", igv: "S/ 0.00", total: "S/ 12.81" });

    await act(async () => {
      host.querySelector<HTMLButtonElement>('button[role="switch"]')?.click();
    });

    expect(totals()).toEqual({ subtotal: "S/ 12.81", igv: "S/ 2.31", total: "S/ 15.12" });
  });

  it("el subtotal de la linea sale de la cantidad redondeada: 1.005 x 10 es 10.10", async () => {
    await render();

    await typeInto(inputs("cantidad")[0], "1.005");
    await typeInto(inputs("costo_unitario")[0], "10");

    expect(totals().subtotal).toBe("S/ 10.10");
  });
});

describe("PurchaseForm: envio y resultado (C3 de la 11.2b)", () => {
  it("envia una clave de operacion guardada para la compra nueva", async () => {
    const received = await render();

    await submit();

    const clave = String(received[0].get("clave_operacion"));

    expect(clave).toMatch(UUID);
    expect(sessionStorage.getItem("clave-operacion:compra:nueva")).toBe(clave);
  });

  it("tras un error conserva las lineas, marca el campo de su linea y la misma clave", async () => {
    const received = await render();

    await act(async () => buttonWith("Agregar material").click());
    await typeInto(inputs("cantidad")[1], "0");
    await submit();
    await submit();

    expect(inputs("cantidad")).toHaveLength(2);
    expect(inputs("cantidad")[1].value).toBe("0");
    expect(inputs("cantidad")[1].getAttribute("aria-invalid")).toBe("true");
    expect(inputs("cantidad")[0].getAttribute("aria-invalid")).toBeNull();
    expect(host.textContent).toContain("La cantidad debe ser mayor que cero.");
    expect(received[1].get("clave_operacion")).toBe(received[0].get("clave_operacion"));
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("tras guardar avisa una vez, renueva la clave y vuelve al listado", async () => {
    const received = await render((formData) => ({
      status: "success",
      data: { id_compra: "COM00000010", clave_operacion: String(formData.get("clave_operacion")) },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    // C1 de la 11.3b (hallazgo 8 de la 11.3a): el aviso exacto, con la nota de los filtros del
    // listado al que vuelve; contar la llamada no notaba un aviso vacio.
    expect(notifications.notify).toHaveBeenCalledWith({ ...NOTIFICATION, description: FILTER_HINT });
    expect(router.push).toHaveBeenCalledWith(RETURN_TO);

    const stored = sessionStorage.getItem("clave-operacion:compra:nueva");

    expect(stored).toMatch(UUID);
    expect(stored).not.toBe(received[0].get("clave_operacion"));
  });
});
