// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { LaborCostFormState } from "@/modules/costs/costings/actions";
import { LaborCostForm } from "@/modules/costs/costings/labor-cost-form";
import type { IndirectCostFormState } from "@/modules/costs/indirect-costs/actions";
import { IndirectCostForm } from "@/modules/costs/indirect-costs/indirect-cost-form";
import type { MarginFormState } from "@/modules/costs/margins/actions";
import { MarginForm } from "@/modules/costs/margins/margin-form";
import { costsNotifications } from "@/modules/costs/notifications";
import type { ProfitabilityFormState } from "@/modules/costs/profitability/actions";
import { ProfitabilityForm } from "@/modules/costs/profitability/profitability-form";

// Formularios de las secciones del detalle del costeo con React real (B4 de la 10.8b, D4).
// Siguen en el detalle: no hay panel ni navegacion. Con error, el mensaje queda en su
// seccion con lo escrito, el campo marcado y enfocado, sin toast. Con exito, un solo aviso
// y el detalle se repinta por la revalidacion de la accion; los formularios que crean un
// registro (indirecto, margen, rentabilidad) vuelven a quedar vacios para el siguiente.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/costs/costings/COS00000004",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const COSTEO = "COS00000004";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  for (const fn of Object.values(navigation)) {
    fn.mockClear();
  }
  notifications.notify.mockClear();
  notifications.showError.mockClear();
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function field<T extends HTMLElement>(id: string) {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`No hay campo ${id}`);
  }
  return element;
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

function expectNoNavigation() {
  for (const fn of Object.values(navigation)) {
    expect(fn).not.toHaveBeenCalled();
  }
}

const textOf = (formData: FormData, name: string) => String(formData.get(name) ?? "");

describe("LaborCostForm", () => {
  async function render(respond: (formData: FormData) => LaborCostFormState) {
    const action = vi.fn(async (_prev: LaborCostFormState, formData: FormData) => respond(formData));

    await act(async () =>
      root.render(
        h(LaborCostForm, {
          action,
          idCosteo: COSTEO,
          defaultValue: "157.44",
          successNotification: costsNotifications["costing-updated"],
        }),
      ),
    );

    return action;
  }

  it("abre con la mano de obra guardada y envia el costeo", async () => {
    const action = await render((formData) => ({
      status: "success",
      data: { id_costeo: COSTEO },
      values: { costo_mano_obra: textOf(formData, "costo_mano_obra") },
      operationId: "op-1",
    }));

    expect(field<HTMLInputElement>("costo_mano_obra").value).toBe("157.44");

    await submit();

    expect((action.mock.calls[0]?.[1] as FormData).get("id_costeo")).toBe(COSTEO);
  });

  it("con error conserva lo escrito, marca el campo con su mensaje y lo enfoca, sin aviso", async () => {
    const message = "El costo de mano de obra no debe superar S/ 9,999,999,999.99.";
    await render((formData) => ({
      status: "error",
      error: "Revisa el costo de mano de obra.",
      fieldErrors: { costo_mano_obra: [message] },
      values: { costo_mano_obra: textOf(formData, "costo_mano_obra") },
      operationId: "op-2",
    }));
    field<HTMLInputElement>("costo_mano_obra").value = "10000000000";

    await submit();

    expect(field<HTMLInputElement>("costo_mano_obra").value).toBe("10000000000");
    expect(field("costo_mano_obra").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field("costo_mano_obra"));
    expect(field("costo_mano_obra-error").textContent).toBe(message);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa el costo de mano de obra.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso, conserva el monto guardado y no navega", async () => {
    await render((formData) => ({
      status: "success",
      data: { id_costeo: COSTEO },
      values: { costo_mano_obra: textOf(formData, "costo_mano_obra") },
      operationId: "op-3",
    }));
    field<HTMLInputElement>("costo_mano_obra").value = "180.5";

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(costsNotifications["costing-updated"]);
    expect(field<HTMLInputElement>("costo_mano_obra").value).toBe("180.5");
    expectNoNavigation();
  });
});

describe("IndirectCostForm", () => {
  const NAMES = ["concepto", "categoria", "monto", "criterio_prorrateo", "periodo", "observaciones"] as const;
  const valuesOf = (formData: FormData) =>
    Object.fromEntries(NAMES.map((name) => [name, textOf(formData, name)])) as Record<(typeof NAMES)[number], string>;

  async function render(respond: (formData: FormData) => IndirectCostFormState) {
    const action = vi.fn(async (_prev: IndirectCostFormState, formData: FormData) => respond(formData));

    await act(async () =>
      root.render(
        h(IndirectCostForm, {
          action,
          idCosteo: COSTEO,
          successNotification: costsNotifications["indirect-cost-created"],
        }),
      ),
    );

    return action;
  }

  function fill() {
    field<HTMLInputElement>("concepto").value = "Transporte del lote";
    field<HTMLSelectElement>("categoria").value = "transporte";
    field<HTMLInputElement>("monto").value = "45.50";
    field<HTMLInputElement>("periodo").value = "2026-11";
  }

  it("con error conserva lo escrito, tambien la categoria, y enfoca el monto", async () => {
    await render((formData) => ({
      status: "error",
      error: "Revisa los datos del costo indirecto.",
      fieldErrors: { monto: ["El monto no debe superar S/ 9,999,999,999.99."] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    fill();

    await submit();

    expect(field<HTMLInputElement>("concepto").value).toBe("Transporte del lote");
    expect(field<HTMLSelectElement>("categoria").value).toBe("transporte");
    expect(field<HTMLInputElement>("periodo").value).toBe("2026-11");
    expect(field("monto").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field("monto"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos del costo indirecto.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y deja el formulario vacio para el siguiente", async () => {
    const action = await render((formData) => ({
      status: "success",
      data: { id_costo_indirecto: "CIN00000009" },
      values: valuesOf(formData),
      operationId: "op-2",
    }));
    fill();

    await submit();

    expect((action.mock.calls[0]?.[1] as FormData).get("id_costeo")).toBe(COSTEO);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(costsNotifications["indirect-cost-created"]);
    expect(field<HTMLInputElement>("concepto").value).toBe("");
    expect(field<HTMLSelectElement>("categoria").value).toBe("luz");
    expect(field<HTMLInputElement>("monto").value).toBe("");
    expectNoNavigation();
  });
});

describe("MarginForm", () => {
  const valuesOf = (formData: FormData) => ({
    porcentaje_margen: textOf(formData, "porcentaje_margen"),
    precio_final: textOf(formData, "precio_final"),
    motivo_ajuste: textOf(formData, "motivo_ajuste"),
  });

  async function render(respond: (formData: FormData) => MarginFormState) {
    const action = vi.fn(async (_prev: MarginFormState, formData: FormData) => respond(formData));

    await act(async () =>
      root.render(
        h(MarginForm, {
          action,
          idCosteo: COSTEO,
          successNotification: costsNotifications["margin-created"],
        }),
      ),
    );

    return action;
  }

  it("con el precio final bajo el costo conserva el margen elegido y enfoca el precio", async () => {
    const message = "El precio final no puede ser menor que el costo total del producto.";
    await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { precio_final: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    field<HTMLSelectElement>("porcentaje_margen").value = "18";
    field<HTMLInputElement>("precio_final").value = "1500";

    await submit();

    expect(field<HTMLSelectElement>("porcentaje_margen").value).toBe("18");
    expect(field<HTMLInputElement>("precio_final").value).toBe("1500");
    expect(field("precio_final").getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field("precio_final"));
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al 15 % sin precio final", async () => {
    await render((formData) => ({
      status: "success",
      data: { id_margen: "MGN00000003" },
      values: valuesOf(formData),
      operationId: "op-2",
    }));
    field<HTMLSelectElement>("porcentaje_margen").value = "18";
    field<HTMLInputElement>("precio_final").value = "1900";

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(costsNotifications["margin-created"]);
    expect(field<HTMLSelectElement>("porcentaje_margen").value).toBe("15");
    expect(field<HTMLInputElement>("precio_final").value).toBe("");
    expectNoNavigation();
  });
});

describe("ProfitabilityForm", () => {
  async function render(respond: (formData: FormData) => ProfitabilityFormState) {
    const action = vi.fn(async (_prev: ProfitabilityFormState, formData: FormData) => respond(formData));

    await act(async () =>
      root.render(
        h(ProfitabilityForm, {
          action,
          idCosteo: COSTEO,
          successNotification: costsNotifications["profitability-created"],
        }),
      ),
    );

    return action;
  }

  it("con un rechazo del calculo muestra el mensaje en la seccion y conserva las observaciones", async () => {
    const message = "Primero debes aplicar un margen de ganancia antes de calcular la rentabilidad.";
    await render((formData) => ({
      status: "error",
      error: message,
      values: { observaciones: textOf(formData, "observaciones") },
      operationId: "op-1",
    }));
    field<HTMLTextAreaElement>("observaciones_rentabilidad").value = "Revisar con ventas";

    await submit();

    expect(document.querySelector('[role="alert"]')?.textContent).toContain(message);
    expect(field<HTMLTextAreaElement>("observaciones_rentabilidad").value).toBe("Revisar con ventas");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y deja las observaciones vacias", async () => {
    await render((formData) => ({
      status: "success",
      data: { id_rentabilidad: "REN00000004" },
      values: { observaciones: textOf(formData, "observaciones") },
      operationId: "op-2",
    }));
    field<HTMLTextAreaElement>("observaciones_rentabilidad").value = "Rentable";

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(costsNotifications["profitability-created"]);
    expect(field<HTMLTextAreaElement>("observaciones_rentabilidad").value).toBe("");
    expectNoNavigation();
  });
});
