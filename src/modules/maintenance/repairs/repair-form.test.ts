// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { maintenanceNotifications } from "@/modules/maintenance/notifications";
import type { RepairFormState } from "@/modules/maintenance/repairs/actions";
import { RepairForm } from "@/modules/maintenance/repairs/repair-form";

// Formulario de reparaciones con React real (entrega 10.5b), la superficie
// amplia de Mantenimiento: lineas dinamicas sin tope, vista previa con la
// funcion que guarda y cada error junto a su linea. Los importes esperados son
// los de Postgres (src/lib/repair-amounts.test.ts).

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/maintenance/repairs/new",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

class ResizeObserverDouble {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
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
  vi.unstubAllGlobals();
});

const LIST = "/dashboard/maintenance/repairs";
const FAILURES = [{ id: "FAL00000007", label: "Torno paralelo", description: "Pendiente" }];
const SPARE_PARTS = [
  { id: "REP00000001", label: "Rodamiento 6205", description: "S/ 10.25", costo_unitario: "10.25" },
  { id: "REP00000002", label: "Reten 35x52", description: "S/ 10.25", costo_unitario: "10.25" },
];

type Respond = (formData: FormData) => RepairFormState;

const values = (formData: FormData) => ({
  id_falla: String(formData.get("id_falla")),
  fecha_reparacion: String(formData.get("fecha_reparacion")),
  estado_reparacion: String(formData.get("estado_reparacion")),
  mano_obra: String(formData.get("mano_obra")),
  tecnico_proveedor: String(formData.get("tecnico_proveedor")),
  observaciones: String(formData.get("observaciones")),
  items: [],
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_reparacion: "RPA00000021" },
  values: values(formData),
  operationId: "op-ok",
});

const rejected =
  (fieldErrors: Record<string, string[]>, error = "Revisa los datos de la reparación."): Respond =>
  (formData) => ({ status: "error", error, fieldErrors, values: values(formData), operationId: "op-1" });

async function renderForm(respond: Respond, returnTo = LIST) {
  const action = vi.fn(async (_prev: RepairFormState, formData: FormData) => respond(formData));

  await act(async () =>
    root.render(
      h(RepairForm, {
        action,
        failures: FAILURES,
        spareParts: SPARE_PARTS,
        defaultValues: { fecha_reparacion: "2026-07-16", estado_reparacion: "programada" },
        successNotification: maintenanceNotifications["repair-created"],
        returnTo,
      }),
    ),
  );

  return action;
}

const field = <T extends HTMLElement>(id: string) => document.querySelector<T>(`[id="${id}"]`)!;
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;
const buttons = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].filter((item) => item.textContent?.trim() === text);
const submit = () => act(async () => document.querySelector("form")!.requestSubmit());
const add = () => act(async () => button("Agregar repuesto").click());
const preview = () => document.querySelector("dl")!.textContent;

async function setInput(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function choose(id: string, name: string) {
  await act(async () => field<HTMLInputElement>(id).focus());
  const option = [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((item) =>
    item.textContent?.includes(name),
  )!;
  await act(async () => option.click());
}

async function fillRequired() {
  await choose("id_falla", "Torno paralelo");
}

describe("RepairForm: lineas", () => {
  it("empieza sin lineas y agrega las que hagan falta, sin tope", async () => {
    await renderForm(success);

    expect(document.querySelectorAll('input[name="id_repuesto"]')).toHaveLength(0);

    for (let count = 0; count < 5; count += 1) {
      await add();
    }

    expect(document.querySelectorAll('input[name="id_repuesto"]')).toHaveLength(5);
    expect(document.body.textContent).toContain("Repuesto 5");
    expect(document.body.textContent).not.toContain("hasta 3");
  });

  it("quitar una linea renumera, conserva las demas y lleva el foco a Agregar repuesto", async () => {
    await renderForm(success);
    await add();
    await add();
    await choose("id_repuesto-row-2", "Reten");

    await act(async () => buttons("Quitar")[0].click());

    expect(document.querySelectorAll('input[name="id_repuesto"]')).toHaveLength(1);
    expect(document.querySelector<HTMLInputElement>('input[name="id_repuesto"]')?.value).toBe("REP00000002");
    expect(document.body.textContent).toContain("Repuesto 1");
    expect(document.body.textContent).not.toContain("Repuesto 2");
    expect(document.activeElement).toBe(button("Agregar repuesto"));
  });

  it("quitar la ultima linea deja la primera", async () => {
    await renderForm(success);
    await add();
    await add();
    await choose("id_repuesto-row-1", "Rodamiento");

    await act(async () => buttons("Quitar")[1].click());

    expect(document.querySelector<HTMLInputElement>('input[name="id_repuesto"]')?.value).toBe("REP00000001");
    expect(document.querySelectorAll('input[name="id_repuesto"]')).toHaveLength(1);
  });

  it("envia las lineas en orden", async () => {
    const action = await renderForm(success);
    await fillRequired();
    await add();
    await add();
    await choose("id_repuesto-row-1", "Rodamiento");
    await setInput(field("cantidad-row-1"), "2");
    await choose("id_repuesto-row-2", "Reten");
    await setInput(field("cantidad-row-2"), "0.5");

    await submit();

    const sent = action.mock.calls[0][1];

    expect(sent.getAll("id_repuesto")).toEqual(["REP00000001", "REP00000002"]);
    expect(sent.getAll("cantidad")).toEqual(["2", "0.5"]);
    expect(sent.get("id_falla")).toBe("FAL00000007");
  });
});

describe("RepairForm: vista previa", () => {
  it("sin nada vale cero", async () => {
    await renderForm(success);

    expect(preview()).toContain("Costo totalS/ 0.00");
  });

  it("dos repuestos de 1,25 x 10,25 suman 25,62 como se guarda", async () => {
    await renderForm(success);
    await add();
    await add();
    await choose("id_repuesto-row-1", "Rodamiento");
    await setInput(field("cantidad-row-1"), "1.25");
    await choose("id_repuesto-row-2", "Reten");
    await setInput(field("cantidad-row-2"), "1.25");

    expect(field("subtotal-row-1").textContent).toBe("S/ 12.81");
    expect(field("subtotal-row-2").textContent).toBe("S/ 12.81");
    expect(preview()).toContain("RepuestosS/ 25.62");
    expect(preview()).toContain("Costo totalS/ 25.62");
  });

  it("la cantidad y la mano de obra se redondean como se guardan: 1,005 x 10,25 + 150,50", async () => {
    await renderForm(success);
    await add();
    await choose("id_repuesto-row-1", "Rodamiento");
    await setInput(field("cantidad-row-1"), "1.005");
    await setInput(field("mano_obra"), "150.50");

    expect(field("subtotal-row-1").textContent).toBe("S/ 10.35");
    expect(preview()).toContain("Mano de obraS/ 150.50");
    expect(preview()).toContain("Costo totalS/ 160.85");
  });

  it("quitar una linea la saca del total", async () => {
    await renderForm(success);
    await add();
    await choose("id_repuesto-row-1", "Rodamiento");
    await setInput(field("cantidad-row-1"), "2");
    expect(preview()).toContain("Costo totalS/ 20.50");

    await act(async () => button("Quitar").click());

    expect(preview()).toContain("Costo totalS/ 0.00");
  });
});

describe("RepairForm: resultado", () => {
  it("con error conserva todo, enfoca el campo de la linea y no da ningun otro aviso", async () => {
    await renderForm(rejected({ "items.1.cantidad": ["Ingrese la cantidad del repuesto."] }));
    await fillRequired();
    await setInput(field("mano_obra"), "80");
    await add();
    await add();
    await choose("id_repuesto-row-1", "Rodamiento");
    await choose("id_repuesto-row-2", "Reten");
    await setInput(field("cantidad-row-2"), "");

    await submit();

    const quantity = field<HTMLInputElement>("cantidad-row-2");

    expect(quantity.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(quantity);
    expect(document.body.textContent).toContain("Ingrese la cantidad del repuesto.");
    expect(field<HTMLInputElement>("cantidad-row-1").hasAttribute("aria-invalid")).toBe(false);
    expect(document.querySelector<HTMLInputElement>('input[name="id_falla"]')?.value).toBe("FAL00000007");
    expect(field<HTMLInputElement>("mano_obra").value).toBe("80");
    expect([...document.querySelectorAll<HTMLInputElement>('input[name="id_repuesto"]')].map((item) => item.value)).toEqual([
      "REP00000001",
      "REP00000002",
    ]);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("el error de un repuesto va en su busqueda y el de la linea entera, en la linea", async () => {
    await renderForm(
      rejected({
        "items.0.id_repuesto": ["El repuesto seleccionado no existe o está inactivo."],
        "items.1": ["El subtotal de un repuesto no debe superar S/ 9,999,999,999.99."],
      }),
    );
    await fillRequired();
    await add();
    await add();

    await submit();

    const combobox = field<HTMLInputElement>("id_repuesto-row-1");

    expect(combobox.getAttribute("aria-invalid")).toBe("true");
    expect(combobox.getAttribute("aria-describedby")).toBe("id_repuesto-row-1-error");
    expect(field("id_repuesto-row-1-error").textContent).toBe("El repuesto seleccionado no existe o está inactivo.");
    expect(document.body.textContent).toContain("El subtotal de un repuesto no debe superar S/ 9,999,999,999.99.");
  });

  it("el error de la falla va junto a su busqueda", async () => {
    await renderForm(rejected({ id_falla: ["La falla seleccionada no existe."] }, "La falla seleccionada no existe."));
    await fillRequired();

    await submit();

    expect(field("id_falla").getAttribute("aria-invalid")).toBe("true");
    expect(field("id_falla-error").textContent).toBe("La falla seleccionada no existe.");
    expect(document.querySelector('[role="alert"]')?.textContent).toBe("La falla seleccionada no existe.");
  });

  it("al guardar da un solo aviso y vuelve al listado sin preguntar, aunque hubiera cambios", async () => {
    await renderForm(success);
    await fillRequired();
    await add();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(maintenanceNotifications["repair-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("con filtros en el listado el aviso lo advierte", async () => {
    await renderForm(success, `${LIST}?status=anulada`);
    await fillRequired();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...maintenanceNotifications["repair-created"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
    expect(navigation.push).toHaveBeenCalledWith(`${LIST}?status=anulada`);
  });
});

describe("RepairForm: descarte", () => {
  const cancel = () => [...document.querySelectorAll("a")].find((item) => item.textContent === "Cancelar")!;
  const click = (init: MouseEventInit = {}) =>
    act(async () => {
      cancel().dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
    });

  it("sin cambios Cancelar sale", async () => {
    await renderForm(success);

    await click();

    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("escribir, elegir o agregar una linea pide confirmar", async () => {
    await renderForm(success);
    await add();

    await click();

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la reparación nueva?");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("elegir una falla sin escribir tambien cuenta como cambio", async () => {
    await renderForm(success);
    await fillRequired();

    await click();

    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  });

  it("quitar una linea tambien cuenta como cambio", async () => {
    await renderForm(success);
    await add();
    await act(async () => button("Quitar").click());

    await click();

    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
  });
});
