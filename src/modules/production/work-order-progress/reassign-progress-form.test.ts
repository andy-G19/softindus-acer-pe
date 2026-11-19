// @vitest-environment jsdom
import { act, createElement as h, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReassignProgressFormState } from "@/modules/production/work-order-progress/actions";
import { ReassignProgressForm } from "@/modules/production/work-order-progress/reassign-progress-form";

// Reasignar el operario de un avance en su pagina (C5 de la 11.6c, D82), con React real. Antes era
// un formulario que redirigia y lanzaba cualquier rechazo (un operario inactivo, el mismo de antes)
// a la pagina de error, donde se perdia lo escrito. Ahora el error queda en su campo con el
// operario elegido y el motivo, y al guardar da un solo aviso y vuelve a los avances de la orden.
// Cancelar sin cambios vuelve sin preguntar.

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AVANCE = "AVN00000002";
const PROGRESS = "/dashboard/production/work-orders/OTR00000007/progress";
const REASSIGNED = { type: "success", message: "Avance reasignado" } as const;
const OPERATORS = [
  { id: "OPE00000004", label: "Huaman, Rosa", description: "Soldadora" },
  { id: "OPE00000005", label: "Rojas, Pedro", description: "Operario" },
];

type Props = ComponentProps<typeof ReassignProgressForm>;
type Respond = (formData: FormData) => ReassignProgressFormState;

let host: HTMLDivElement;
let root: Root;

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

const valuesOf = (formData: FormData) => ({
  id_operario_nuevo: String(formData.get("id_operario_nuevo") ?? ""),
  motivo: String(formData.get("motivo") ?? ""),
});

async function render(respond?: Respond, changes: Partial<Props> = {}) {
  const action = vi.fn(async (_prev: ReassignProgressFormState, formData: FormData) => {
    if (!respond) {
      throw new Error("No se esperaba enviar");
    }

    return respond(formData);
  });

  await act(async () =>
    root.render(
      h(ReassignProgressForm, {
        idAvance: AVANCE,
        operators: OPERATORS,
        disabled: false,
        progressHref: PROGRESS,
        action,
        successNotification: REASSIGNED,
        ...changes,
      }),
    ),
  );

  return action;
}

/** Elige una opcion como el usuario: abre la lista del campo y pulsa la opcion. */
async function choose(label: string) {
  await act(async () => {
    control<HTMLInputElement>("#id_operario_nuevo").focus();
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

async function type(value: string) {
  const element = control<HTMLTextAreaElement>('textarea[name="motivo"]');

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function fillAndSubmit() {
  await choose("Huaman, Rosa");
  await type("Cambio de turno");
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

describe("ReassignProgressForm (C5 de la 11.6c)", () => {
  it("envia el avance, el operario elegido y el motivo", async () => {
    const action = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    const formData = action.mock.calls[0]?.[1] as FormData;

    expect(formData.get("id_avance")).toBe(AVANCE);
    expect(valuesOf(formData)).toEqual({ id_operario_nuevo: "OPE00000004", motivo: "Cambio de turno" });
  });

  it("tras un error conserva el operario y el motivo, marca el operario y no da avisos", async () => {
    const message = "El nuevo operario no existe o esta inactivo.";

    await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { id_operario_nuevo: [message] },
      values: valuesOf(formData),
      operationId: "op-2",
    }));

    await fillAndSubmit();

    expect(control<HTMLInputElement>('input[name="id_operario_nuevo"]').value).toBe("OPE00000004");
    expect(control<HTMLTextAreaElement>('textarea[name="motivo"]').value).toBe("Cambio de turno");
    expect(control("#id_operario_nuevo").getAttribute("aria-invalid")).toBe("true");
    // C2 de la 11.7d2 (D111): el mensaje queda bajo su campo y la alerta no lo repite.
    expect(control('[role="alert"]')?.textContent).toBe("Revisa los campos marcados.");
    expect(document.body.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("al guardar da un aviso y vuelve a los avances de la orden", async () => {
    await render((formData) => ({
      status: "success",
      data: { id_avance: AVANCE, id_orden_trabajo: "OTR00000007" },
      values: valuesOf(formData),
      operationId: "op-3",
    }));

    await fillAndSubmit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(REASSIGNED);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(PROGRESS);
  });

  it("cancelar sin cambios vuelve a los avances sin preguntar", async () => {
    await render();

    const cancel = [...host.querySelectorAll<HTMLAnchorElement>("a")].find((link) => link.textContent?.trim() === "Cancelar");

    expect(cancel?.getAttribute("href")).toBe(PROGRESS);

    await act(async () => {
      cancel?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });

    expect(router.push).toHaveBeenCalledWith(PROGRESS);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });
});
