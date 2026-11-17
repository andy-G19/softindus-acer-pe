// @vitest-environment jsdom
import { act, createElement as h, Fragment, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StageProgressFormState } from "@/modules/production/work-order-progress/actions";
import { StageProgressForm } from "@/modules/production/work-order-progress/stage-progress-form";

// Actualizar una etapa desde su tarjeta en la pagina de avances (C4 de la 11.6c, D81), con React
// real. Antes era un formulario que redirigia y lanzaba cualquier rechazo a la pagina de error,
// donde se perdia lo escrito. Ahora el error queda en su campo con lo escrito y el exito da un
// aviso. Terminar la ultima etapa finaliza la orden y la revalidacion repinta todas las tarjetas
// deshabilitadas en la misma respuesta: la tarjeta queda montada para que el aviso salga (hallazgo
// 9 de la 11.2a). Cada tarjeta da ids propios a sus campos: una pagina tiene una por etapa.

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AVANCE = "AVN00000002";
const UPDATED = { type: "success", message: "Avance actualizado" } as const;

type Props = ComponentProps<typeof StageProgressForm>;
type Respond = (formData: FormData) => StageProgressFormState;

let host: HTMLDivElement;
let root: Root;
let current: Props;

beforeEach(() => {
  notifications.notify.mockReset();
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

const percentage = () => control<HTMLInputElement>('input[name="porcentaje_avance"]');
const status = () => control<HTMLSelectElement>('select[name="estado_etapa"]');
const notes = () => control<HTMLTextAreaElement>('textarea[name="observaciones"]');

/** La revalidacion repinta la pagina: se llama desde la accion, antes de que responda. */
function repaint(changes: Partial<Props>) {
  current = { ...current, ...changes };
  root.render(h(StageProgressForm, current));
}

const valuesOf = (formData: FormData) => ({
  estado_etapa: String(formData.get("estado_etapa") ?? ""),
  porcentaje_avance: String(formData.get("porcentaje_avance") ?? ""),
  observaciones: String(formData.get("observaciones") ?? ""),
});

function props(respond: Respond | undefined, changes: Partial<Props> = {}): Props {
  return {
    idAvance: AVANCE,
    estadoEtapa: "en_proceso",
    porcentajeAvance: 40,
    observaciones: null,
    disabled: false,
    header: h("h2", null, "2. Soldadura"),
    operator: h("p", null, "Quispe, Luis"),
    details: h("p", null, "Inicio de etapa"),
    history: null,
    action: vi.fn(async (_prev: StageProgressFormState, formData: FormData) => {
      if (!respond) {
        throw new Error("No se esperaba enviar");
      }

      return respond(formData);
    }),
    successNotification: UPDATED,
    ...changes,
  };
}

async function render(respond?: Respond, changes: Partial<Props> = {}) {
  current = props(respond, changes);
  await act(async () => root.render(h(StageProgressForm, current)));

  return current.action as ReturnType<typeof vi.fn>;
}

/** Cambia un campo como el usuario: React necesita el evento para su onChange. */
async function change(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  const prototype = Object.getPrototypeOf(element) as object;

  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
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

describe("StageProgressForm (C4 de la 11.6c)", () => {
  it("envia el avance con su estado, su porcentaje y las observaciones", async () => {
    const action = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    expect(status().value).toBe("en_proceso");
    expect(percentage().value).toBe("40");

    await change(status(), "pausada");
    await change(percentage(), "55");
    await change(notes(), "Falta soldadura");
    await submit();

    const formData = action.mock.calls[0]?.[1] as FormData;

    expect(formData.get("id_avance")).toBe(AVANCE);
    expect(valuesOf(formData)).toEqual({
      estado_etapa: "pausada",
      porcentaje_avance: "55",
      observaciones: "Falta soldadura",
    });
  });

  it("tras un error conserva lo escrito, marca el campo, muestra el mensaje y no da avisos", async () => {
    const message = "El porcentaje no puede ser mayor a 100.";

    await render((formData) => ({
      status: "error",
      error: "Revisa los datos de la etapa.",
      fieldErrors: { porcentaje_avance: [message] },
      values: valuesOf(formData),
      operationId: "op-2",
    }));

    await change(status(), "pausada");
    await change(percentage(), "120");
    await change(notes(), "Falta soldadura");
    await submit();

    expect(status().value).toBe("pausada");
    expect(percentage().value).toBe("120");
    expect(notes().value).toBe("Falta soldadura");
    expect(percentage().getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
    expect(control('[role="alert"]').textContent).toContain("Revisa los datos de la etapa.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("terminar la ultima etapa da su aviso aunque la orden finalice y la tarjeta llegue deshabilitada", async () => {
    await render((formData) => {
      // La orden queda finalizada: la pagina repinta la etapa guardada y la deshabilita.
      repaint({ estadoEtapa: "terminada", porcentajeAvance: 100, disabled: true });

      return {
        status: "success",
        data: { id_avance: AVANCE, id_orden_trabajo: "OTR00000007" },
        values: valuesOf(formData),
        operationId: "op-3",
      };
    });

    await change(status(), "terminada");
    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(UPDATED);
    expect(router.push).not.toHaveBeenCalled();
    expect(host.querySelector("form")).not.toBeNull();
    expect(status().value).toBe("terminada");
    expect(percentage().value).toBe("100");
    expect(status().disabled).toBe(true);
    expect(percentage().disabled).toBe(true);
  });

  it("cada tarjeta da a sus campos ids propios, asociados a su etiqueta", async () => {
    const first = props(undefined, { idAvance: "AVN00000001" });
    const second = props(undefined, { idAvance: "AVN00000002" });

    await act(async () => root.render(h(Fragment, null, h(StageProgressForm, first), h(StageProgressForm, second))));

    const ids = [...host.querySelectorAll<HTMLInputElement>('input[name="porcentaje_avance"]')].map((input) => input.id);

    expect(ids).toEqual(["porcentaje_avance_AVN00000001", "porcentaje_avance_AVN00000002"]);

    for (const id of [...ids, "estado_etapa_AVN00000001", "observaciones_AVN00000002"]) {
      expect(host.querySelector(`label[for="${id}"]`)).not.toBeNull();
    }
  });
});
