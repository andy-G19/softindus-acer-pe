// @vitest-environment jsdom
import { act, createElement as h, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { FailureStatusSelect } from "@/modules/maintenance/failures/failure-status-select";
import { PreventiveStatusSelect } from "@/modules/maintenance/preventive/preventive-status-select";
import { RepairStatusSelect } from "@/modules/maintenance/repairs/repair-status-select";

// Las confirmaciones del cambio de estado de Mantenimiento (entrega 10.5b), con
// el Radix real: un snapshot de pagina no distingue un boton con confirmacion de
// uno sin ella. Anular confirma con el boton destructivo; los demas estados
// finales, con el normal porque no borran nada; los estados que se pueden
// deshacer se aplican al pulsar. Un registro cerrado no ofrece selector.

const notifications = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);

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
  notifications.notify.mockClear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const NOTIFICATION = { type: "success" as const, message: "Estado actualizado" };

function succeed(_prev: RowStatusState, formData: FormData): Promise<RowStatusState> {
  return Promise.resolve({
    status: "success",
    data: { estado: String([...formData.values()].at(-1)) },
    values: { id: "X" },
    operationId: crypto.randomUUID(),
  });
}

const select = () => document.querySelector<HTMLSelectElement>("select");
const confirmation = () => document.querySelector('[role="alertdialog"]');
const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text);

async function choose(value: string) {
  const element = select()!;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;

  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function press(element: ReactElement, value: string) {
  await act(async () => root.render(element));
  await choose(value);
  await act(async () => button("Guardar")!.click());
}

const failureSelect = (estado_atencion: string, action = vi.fn(succeed)) =>
  h(FailureStatusSelect, {
    failure: { id_falla: "FAL00000001", estado_atencion },
    action,
    successNotification: NOTIFICATION,
  });

const preventiveSelect = (estado: string, isOverdue = false, action = vi.fn(succeed)) =>
  h(PreventiveStatusSelect, {
    maintenance: { id_mantenimiento: "MTP00000001", estado },
    isOverdue,
    action,
    successNotification: NOTIFICATION,
  });

const repairSelect = (estado_reparacion: string, action = vi.fn(succeed)) =>
  h(RepairStatusSelect, {
    repair: { id_reparacion: "RPA00000001", estado_reparacion },
    action,
    successNotification: NOTIFICATION,
  });

describe.each([
  ["falla reparada", () => failureSelect("pendiente"), "reparada", "¿Marcar la falla FAL00000001 como reparada?", "ni registrar reparaciones sobre ella", "Marcar reparada", "default"],
  ["falla anulada", () => failureSelect("pendiente"), "anulada", "¿Anular la falla FAL00000001?", "Se conserva en la lista.", "Anular", "destructive"],
  ["preventivo realizado", () => preventiveSelect("pendiente"), "realizado", "¿Marcar el mantenimiento MTP00000001 como realizado?", "La fecha de hoy quedará como fecha realizada.", "Marcar realizado", "default"],
  ["preventivo anulado", () => preventiveSelect("pendiente"), "anulado", "¿Anular el mantenimiento MTP00000001?", "Se conserva en la lista.", "Anular", "destructive"],
  ["reparacion ejecutada", () => repairSelect("programada"), "ejecutada", "¿Marcar la reparación RPA00000001 como ejecutada?", "La falla quedará reparada y la máquina, operativa.", "Marcar ejecutada", "default"],
  ["reparacion anulada", () => repairSelect("programada"), "anulada", "¿Anular la reparación RPA00000001?", "La falla volverá a pendiente y la máquina no cambia de estado.", "Anular", "destructive"],
] as const)("%s", (_name, render, value, title, consequence, confirmText, variant) => {
  it("confirma con la entidad, la consecuencia y su boton", async () => {
    await press(render(), value);

    expect(confirmation()?.textContent).toContain(title);
    expect(confirmation()?.textContent).toContain(consequence);
    expect(button(confirmText)?.getAttribute("data-variant")).toBe(variant);
  });
});

describe.each([
  ["falla en atencion", failureSelect, "pendiente", "en_atencion"],
  ["falla pendiente", failureSelect, "en_atencion", "pendiente"],
  ["preventivo vencido", preventiveSelect, "pendiente", "vencido"],
  ["reparacion observada", repairSelect, "programada", "observada"],
] as const)("%s", (_name, render, current, value) => {
  it("se aplica al pulsar, sin confirmar", async () => {
    const action = vi.fn(succeed);
    const element =
      render === preventiveSelect
        ? preventiveSelect(current, false, action)
        : (render as typeof failureSelect)(current, action);

    await press(element, value);

    expect(confirmation()).toBeNull();
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("un registro cerrado no ofrece selector", () => {
  it.each([
    ["falla reparada", () => failureSelect("reparada")],
    ["falla anulada", () => failureSelect("anulada")],
    ["preventivo realizado", () => preventiveSelect("realizado")],
    ["preventivo anulado", () => preventiveSelect("anulado")],
    ["reparacion ejecutada", () => repairSelect("ejecutada")],
    ["reparacion anulada", () => repairSelect("anulada")],
  ])("%s", async (_name, render) => {
    await act(async () => root.render(render()));

    expect(select()).toBeNull();
    expect(host.textContent).toBe("Sin accion");
  });
});

describe("un preventivo pendiente con fecha pasada", () => {
  it("se muestra Vencido y guardarlo es un cambio", async () => {
    const action = vi.fn(succeed);
    await act(async () => root.render(preventiveSelect("pendiente", true, action)));

    expect(select()?.value).toBe("vencido");
    expect(button("Guardar")?.hasAttribute("aria-disabled")).toBe(false);

    await act(async () => button("Guardar")!.click());

    expect(action).toHaveBeenCalledTimes(1);
    expect(action.mock.calls[0][1].get("estado")).toBe("vencido");
    expect(action.mock.calls[0][1].get("id_mantenimiento")).toBe("MTP00000001");
  });

  it("volver a Pendiente no es un cambio", async () => {
    await act(async () => root.render(preventiveSelect("pendiente", true)));

    await choose("pendiente");

    expect(button("Guardar")?.getAttribute("aria-disabled")).toBe("true");
  });

  it("uno vencido guardado no se puede volver a guardar", async () => {
    await act(async () => root.render(preventiveSelect("vencido")));

    expect(button("Guardar")?.getAttribute("aria-disabled")).toBe("true");
  });
});

describe("cada selector envia su campo", () => {
  it.each([
    ["falla", () => failureSelect("pendiente"), "id_falla", "FAL00000001", "estado_atencion", "Estado de la falla FAL00000001"],
    ["reparacion", () => repairSelect("programada"), "id_reparacion", "RPA00000001", "estado_reparacion", "Estado de la reparación RPA00000001"],
  ])("%s", async (_name, render, idField, id, statusField, label) => {
    const element = render();
    await act(async () => root.render(element));

    expect(select()?.getAttribute("aria-label")).toBe(label);

    await choose(statusField === "estado_atencion" ? "en_atencion" : "observada");
    await act(async () => button("Guardar")!.click());

    const sent = (element.props as unknown as { action: ReturnType<typeof vi.fn> }).action.mock.calls[0][1] as FormData;

    expect(sent.get(idField)).toBe(id);
    expect(sent.has(statusField)).toBe(true);
  });
});
