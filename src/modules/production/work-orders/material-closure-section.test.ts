// @vitest-environment jsdom
import { act, createElement as h, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CloseMaterialsFormState,
  ReopenMaterialsFormState,
} from "@/modules/production/work-orders/actions";
import { MaterialClosureSection } from "@/modules/production/work-orders/material-closure-section";

// Cerrar y reabrir los materiales de una orden en su seccion del detalle (C2 de la 11.6b, D74) con
// React real. El exito cambia lo que la seccion muestra (de «Cerrar materiales» al resumen del
// cierre con «Reabrir», y al reves), y la revalidacion trae ese cambio con la misma respuesta: un
// formulario que se desmonta en ese repintado nunca da su aviso (hallazgo 9 de la 11.2a). Por eso
// la seccion queda montada y las pruebas repintan con el estado nuevo desde dentro de la accion.
// Tras un error se conserva lo declarado, el campo queda marcado y no hay avisos; no hay clave: la
// fecha de cierre ya hace que un segundo envio no escriba.

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OT = "OTR00000007";
const CLOSE_NOTIFICATION = { type: "success", message: "Materiales cerrados" } as const;
const REOPEN_NOTIFICATION = { type: "success", message: "Cierre reabierto" } as const;
const SUMMARY = "Materiales cerrados el 17 nov. 2026.";
const MOVEMENTS = "Formulario de entrega adicional o devolucion";
const LINES = [
  { idRequerimiento: "ROM00000001", materialName: "Plancha LAC 2 mm", unidad: "kg", delivered: 20, returned: 2 },
  { idRequerimiento: "ROM00000002", materialName: "Soldadura", unidad: "kg", delivered: 60, returned: 0 },
];

type Props = ComponentProps<typeof MaterialClosureSection>;
type CloseRespond = (formData: FormData) => CloseMaterialsFormState;
type ReopenRespond = (formData: FormData) => ReopenMaterialsFormState;

let host: HTMLDivElement;
let root: Root;
let current: Props;

beforeEach(() => {
  notifications.notify.mockReset();
  notifications.showError.mockReset();
  router.push.mockReset();
  router.refresh.mockReset();
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

const consumedInputs = () => Array.from(host.querySelectorAll<HTMLInputElement>('input[name="cantidad_consumida"]'));

/** La revalidacion repinta el detalle: se llama desde la accion, antes de que responda. */
function repaint(changes: Partial<Props>) {
  current = { ...current, ...changes };
  root.render(h(MaterialClosureSection, current));
}

async function render(
  { close, reopen }: { close?: CloseRespond; reopen?: ReopenRespond },
  changes: Partial<Props> = {},
) {
  const received: { operacion: string; formData: FormData }[] = [];
  const unexpected = (operacion: string) => () => {
    throw new Error(`No se esperaba ${operacion}`);
  };

  current = {
    idOrdenTrabajo: OT,
    closed: false,
    canReopen: true,
    hasDeliveries: true,
    closedSummary: h("p", null, SUMMARY),
    movementForm: h("p", null, MOVEMENTS),
    lines: LINES,
    productUnit: "und",
    closeAction: vi.fn(async (_prev: CloseMaterialsFormState, formData: FormData) => {
      received.push({ operacion: "cerrar", formData });
      return (close ?? unexpected("cerrar"))(formData);
    }),
    reopenAction: vi.fn(async (_prev: ReopenMaterialsFormState, formData: FormData) => {
      received.push({ operacion: "reabrir", formData });
      return (reopen ?? unexpected("reabrir"))(formData);
    }),
    closeNotification: CLOSE_NOTIFICATION,
    reopenNotification: REOPEN_NOTIFICATION,
    ...changes,
  };

  await act(async () => root.render(h(MaterialClosureSection, current)));

  return received;
}

/** Cambia un campo como el usuario: React necesita el evento para su onChange. */
async function type(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element) as object;

  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

async function fillCloseAndSubmit() {
  await type(consumedInputs()[1], "50");
  await type(control<HTMLInputElement>('input[name="cantidad_producida"]'), "9");
  await submit();
}

const closeValuesOf = (formData: FormData) => {
  const consumed = formData.getAll("cantidad_consumida").map(String);

  return {
    cantidad_producida: String(formData.get("cantidad_producida") ?? ""),
    lineas: formData.getAll("id_requerimiento").map((id, index) => ({
      id_requerimiento: String(id),
      cantidad_consumida: consumed[index] ?? "",
    })),
  };
};

describe("MaterialClosureSection (C2 de la 11.6b)", () => {
  it("cerrar envia la orden, cada material con lo consumido y lo producido", async () => {
    const received = await render({
      close: (formData) => ({
        status: "error",
        error: "x",
        values: closeValuesOf(formData),
        operationId: "op-1",
      }),
    });

    await fillCloseAndSubmit();

    expect(received.map((item) => item.operacion)).toEqual(["cerrar"]);
    expect(received[0].formData.get("id_orden_trabajo")).toBe(OT);
    expect(closeValuesOf(received[0].formData)).toEqual({
      cantidad_producida: "9",
      lineas: [
        { id_requerimiento: "ROM00000001", cantidad_consumida: "18.00" },
        { id_requerimiento: "ROM00000002", cantidad_consumida: "50" },
      ],
    });
    expect(host.textContent).toContain(MOVEMENTS);
  });

  it("tras un error conserva lo declarado, marca la linea, muestra el mensaje y no da avisos", async () => {
    const message = "Soldadura: lo consumido mas lo devuelto supera lo entregado.";

    await render({
      close: (formData) => ({
        status: "error",
        error: message,
        fieldErrors: { "lineas.1.cantidad_consumida": [message] },
        values: closeValuesOf(formData),
        operationId: "op-2",
      }),
    });

    await fillCloseAndSubmit();

    expect(consumedInputs().map((input) => input.value)).toEqual(["18.00", "50"]);
    expect(control<HTMLInputElement>('input[name="cantidad_producida"]').value).toBe("9");
    expect(consumedInputs().map((input) => input.getAttribute("aria-invalid"))).toEqual([null, "true"]);
    expect(control('[role="alert"]').textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("un error de lo producido queda en su campo", async () => {
    const message = "La cantidad producida no puede ser negativa.";

    await render({
      close: (formData) => ({
        status: "error",
        error: "Revisa el cierre de materiales.",
        fieldErrors: { cantidad_producida: [message] },
        values: closeValuesOf(formData),
        operationId: "op-3",
      }),
    });

    await fillCloseAndSubmit();

    expect(control('input[name="cantidad_producida"]').getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
  });

  it("el cierre da su aviso aunque la seccion llegue ya cerrada, y muestra el resumen y reabrir", async () => {
    await render({
      close: (formData) => {
        repaint({ closed: true });

        return { status: "success", data: { id_orden_trabajo: OT }, values: closeValuesOf(formData), operationId: "op-4" };
      },
    });

    await fillCloseAndSubmit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(CLOSE_NOTIFICATION);
    expect(router.push).not.toHaveBeenCalled();
    expect(host.textContent).toContain(SUMMARY);
    expect(host.textContent).not.toContain(MOVEMENTS);
    expect(host.querySelector('input[name="cantidad_consumida"]')).toBeNull();
    expect(control<HTMLTextAreaElement>('textarea[name="motivo"]').value).toBe("");
  });

  it("cerrada y sin permiso de reabrir, solo muestra el resumen", async () => {
    await render({}, { closed: true, canReopen: false });

    expect(host.textContent).toContain(SUMMARY);
    expect(host.querySelector("form")).toBeNull();
  });

  it("reabrir envia la orden y el motivo; tras un error lo conserva y lo marca", async () => {
    const message = "Explica por qué se reabre el cierre (mínimo 10 caracteres).";
    const received = await render(
      {
        reopen: (formData) => ({
          status: "error",
          error: "Revisa el motivo de la reapertura.",
          fieldErrors: { motivo: [message] },
          values: { motivo: String(formData.get("motivo") ?? "") },
          operationId: "op-5",
        }),
      },
      { closed: true },
    );

    await type(control<HTMLTextAreaElement>('textarea[name="motivo"]'), "conteo");
    await submit();

    expect(received.map((item) => item.operacion)).toEqual(["reabrir"]);
    expect(received[0].formData.get("id_orden_trabajo")).toBe(OT);
    expect(received[0].formData.get("motivo")).toBe("conteo");
    expect(control<HTMLTextAreaElement>('textarea[name="motivo"]').value).toBe("conteo");
    expect(control('textarea[name="motivo"]').getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("la reapertura da su aviso aunque la seccion llegue abierta, y vuelve a ofrecer cerrar", async () => {
    await render(
      {
        reopen: (formData) => {
          repaint({ closed: false });

          return {
            status: "success",
            data: { id_orden_trabajo: OT },
            values: { motivo: String(formData.get("motivo") ?? "") },
            operationId: "op-6",
          };
        },
      },
      { closed: true },
    );

    await type(control<HTMLTextAreaElement>('textarea[name="motivo"]'), "Se conto mal la plancha sobrante");
    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(REOPEN_NOTIFICATION);
    expect(host.textContent).not.toContain(SUMMARY);
    expect(host.textContent).toContain(MOVEMENTS);
    expect(consumedInputs().map((input) => input.value)).toEqual(["18.00", "60.00"]);
  });

  it("sin entregas no ofrece cerrar: la conciliacion empieza con la primera entrega", async () => {
    await render({}, { hasDeliveries: false });

    expect(host.querySelector("form")).toBeNull();
    expect(host.textContent).toContain("Todavía no se entregó material a esta orden.");
  });
});
