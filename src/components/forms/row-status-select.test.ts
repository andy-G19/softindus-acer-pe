// @vitest-environment jsdom
import { act, createElement as h, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RowStatusSelect } from "@/components/forms/row-status-select";
import type { RowStatusState } from "@/lib/requested-status";

// Cambio de estado desde la fila (entrega 10.5b), con el Radix real. Se apoya
// en ConfirmActionButton: aqui se prueba lo suyo. Guardar envia el estado
// elegido, sin cambio no hace nada y conserva el foco; sin confirmacion el
// error queda en la fila; un estado final confirma, con el boton destructivo
// al anular y el normal en los demas; y al repintarse la lista el selector toma
// el estado nuevo, o la fila recibe el foco si se queda sin selector.

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

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function button(text: string) {
  const element = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === text,
  );
  if (!element) {
    throw new Error(`No hay boton "${text}"`);
  }
  return element;
}

// Clic real de raton: React aplica un onClick despues de los listeners de Radix
// en document si no se fuerza, y el navegador los separa (form-dialog.test.ts).
function mouseClick(element: HTMLElement) {
  const flush = () => flushSync(() => {});
  document.documentElement.addEventListener("click", flush, { once: true });
  element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  element.click();
}

const select = () => document.querySelector<HTMLSelectElement>("select")!;
const confirmation = () => document.querySelector('[role="alertdialog"]');
const UPDATED = { type: "success" as const, message: "Estado de falla actualizado" };
const OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_atencion", label: "En atencion" },
  { value: "reparada", label: "Reparada" },
  { value: "anulada", label: "Anulada" },
];
const CONFIRM = {
  reparada: { title: "¿Marcar la falla como reparada?", description: "No se podrá cambiar.", confirmText: "Marcar", variant: "default" as const },
  anulada: { title: "¿Anular la falla?", description: "No se podrá cambiar.", confirmText: "Anular" },
};

function done(formData: FormData): RowStatusState {
  return {
    status: "success",
    data: { estado: String(formData.get("estado_atencion")) },
    values: { id: "FAL00000001" },
    operationId: crypto.randomUUID(),
  };
}

const rejected = (message: string): RowStatusState => ({
  status: "error",
  error: message,
  values: { id: "FAL00000001" },
  operationId: crypto.randomUUID(),
});

type Action = (prev: RowStatusState, formData: FormData) => Promise<RowStatusState>;

// Una fila de tabla cuyo estado cambia como lo haria la lista al repintarse.
function Row({ action, initial, storedValue }: { action: Action; initial: string; storedValue?: string }) {
  const [status, setStatus] = useState(initial);

  const repainting: Action = async (prev, formData) => {
    const result = await action(prev, formData);

    if (result.status === "success") {
      setStatus(result.data.estado);
    }

    return result;
  };

  return h(
    "table",
    null,
    h(
      "tbody",
      null,
      h(
        "tr",
        null,
        h(
          "td",
          null,
          ["reparada", "anulada"].includes(status)
            ? "Sin accion"
            : h(RowStatusSelect, {
                action: repainting,
                id: "estado-FAL00000001",
                fields: { id_falla: "FAL00000001" },
                name: "estado_atencion",
                label: "Estado de la falla FAL00000001",
                value: status,
                storedValue,
                options: OPTIONS,
                successNotification: UPDATED,
                confirm: CONFIRM,
              }),
        ),
      ),
    ),
  );
}

async function renderRow(action: Action, initial = "pendiente", storedValue?: string) {
  await act(async () => root.render(h(Row, { action, initial, storedValue })));
}

async function choose(value: string) {
  const element = select();
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;

  await act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("RowStatusSelect", () => {
  it("nombra el selector y muestra el estado de la fila", async () => {
    await renderRow(vi.fn());

    expect(select().id).toBe("estado-FAL00000001");
    expect(select().getAttribute("aria-label")).toBe("Estado de la falla FAL00000001");
    expect(select().value).toBe("pendiente");
  });

  it("sin cambio Guardar se anuncia deshabilitado y no hace nada", async () => {
    const action = vi.fn();
    await renderRow(action);

    expect(button("Guardar").getAttribute("aria-disabled")).toBe("true");
    expect(button("Guardar").disabled).toBe(false);

    await act(async () => button("Guardar").click());
    await settle();

    expect(action).not.toHaveBeenCalled();
    expect(confirmation()).toBeNull();
  });

  it("volver a elegir el estado guardado lo deshabilita de nuevo", async () => {
    await renderRow(vi.fn());

    await choose("en_atencion");
    expect(button("Guardar").hasAttribute("aria-disabled")).toBe(false);

    await choose("pendiente");
    expect(button("Guardar").getAttribute("aria-disabled")).toBe("true");
  });

  it("con un estado mostrado distinto del guardado se puede guardar", async () => {
    const action = vi.fn(async (_prev: RowStatusState, formData: FormData) => done(formData));
    await renderRow(action, "en_atencion", "pendiente");

    expect(button("Guardar").hasAttribute("aria-disabled")).toBe(false);

    await act(async () => button("Guardar").click());
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("guardar envia el id y el estado elegido, da un solo aviso y el selector toma el estado nuevo", async () => {
    const action = vi.fn(async (_prev: RowStatusState, formData: FormData) => done(formData));
    await renderRow(action);
    await choose("en_atencion");

    const save = button("Guardar");
    save.focus();
    await act(async () => save.click());
    await settle();

    const sent = action.mock.calls[0][1];

    expect(Object.fromEntries(sent.entries())).toEqual({ id_falla: "FAL00000001", estado_atencion: "en_atencion" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(UPDATED);
    expect(select().value).toBe("en_atencion");
    expect(button("Guardar").getAttribute("aria-disabled")).toBe("true");
    expect(document.activeElement).toBe(button("Guardar"));
  });

  it("si la lista llega con otro estado, el selector lo toma aunque hubiera elegido otro", async () => {
    const render = (value: string) =>
      root.render(
        h(RowStatusSelect, {
          action: vi.fn(),
          id: "estado-FAL00000001",
          fields: { id_falla: "FAL00000001" },
          name: "estado_atencion",
          label: "Estado de la falla FAL00000001",
          value,
          options: OPTIONS,
          successNotification: UPDATED,
        }),
      );

    await act(async () => render("pendiente"));
    await choose("reparada");

    await act(async () => render("en_atencion"));

    expect(select().value).toBe("en_atencion");
    expect(button("Guardar").getAttribute("aria-disabled")).toBe("true");
  });

  it("un error sin confirmacion queda en la fila, sin aviso, y se limpia al cambiar el estado", async () => {
    await renderRow(async () => rejected("La falla ya estaba en ese estado."));
    await choose("en_atencion");

    await act(async () => button("Guardar").click());
    await settle();

    const message = document.querySelector('[role="alert"]');

    expect(message?.textContent).toBe("La falla ya estaba en ese estado.");
    expect(message?.id).toBe("estado-FAL00000001-error");
    expect(select().getAttribute("aria-invalid")).toBe("true");
    expect(select().getAttribute("aria-describedby")).toBe("estado-FAL00000001-error");
    expect(select().value).toBe("en_atencion");
    expect(notifications.notify).not.toHaveBeenCalled();

    await choose("pendiente");

    expect(document.querySelector('[role="alert"]')).toBeNull();
    expect(select().hasAttribute("aria-invalid")).toBe(false);
  });

  it("volver a guardar limpia el error anterior", async () => {
    const action = vi
      .fn<Action>()
      .mockResolvedValueOnce(rejected("Fallo la primera vez."))
      .mockImplementation(async (_prev, formData) => done(formData));
    await renderRow(action);
    await choose("en_atencion");

    await act(async () => button("Guardar").click());
    await settle();
    expect(document.querySelector('[role="alert"]')).not.toBeNull();

    await act(async () => button("Guardar").click());
    await settle();

    expect(document.querySelector('[role="alert"]')).toBeNull();
  });

  it("anular confirma con el boton destructivo y no ejecuta antes de confirmar", async () => {
    const action = vi.fn(async (_prev: RowStatusState, formData: FormData) => done(formData));
    await renderRow(action);
    await choose("anulada");

    await act(async () => button("Guardar").click());

    expect(confirmation()?.textContent).toContain("¿Anular la falla?");
    expect(action).not.toHaveBeenCalled();
    expect(button("Anular").getAttribute("data-variant")).toBe("destructive");
  });

  it("un estado final que no borra nada confirma con el boton normal", async () => {
    await renderRow(vi.fn());
    await choose("reparada");

    await act(async () => button("Guardar").click());

    expect(confirmation()?.textContent).toContain("¿Marcar la falla como reparada?");
    expect(button("Marcar").getAttribute("data-variant")).toBe("default");
  });

  it("confirmar un estado final deja la fila sin selector y el foco en la fila", async () => {
    await renderRow(async (_prev, formData) => done(formData));
    await choose("anulada");

    const save = button("Guardar");
    save.focus();
    await act(async () => save.click());
    await act(async () => mouseClick(button("Anular")));
    await settle();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(select()).toBeNull();
    expect(document.querySelector("tr")?.textContent).toBe("Sin accion");
    expect(document.activeElement).toBe(document.querySelector("tr"));
  });

  it("mientras confirma, el pendiente va en la confirmacion y no en Guardar", async () => {
    let finish = () => {};
    await renderRow(
      (_prev, formData) =>
        new Promise((resolve) => {
          finish = () => resolve(done(formData));
        }),
    );
    await choose("anulada");

    await act(async () => button("Guardar").click());
    await act(async () => mouseClick(button("Anular")));

    expect(button("Guardar").hasAttribute("aria-busy")).toBe(false);

    await act(async () => finish());
    await settle();
  });

  it("un error con confirmacion queda dentro de ella", async () => {
    await renderRow(async () => rejected("No se pudo anular."));
    await choose("anulada");

    await act(async () => button("Guardar").click());
    await act(async () => mouseClick(button("Anular")));
    await settle();

    expect(confirmation()?.textContent).toContain("No se pudo anular.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("cambiar de un estado con confirmacion a uno sin ella no remonta el boton", async () => {
    await renderRow(vi.fn());
    await choose("en_atencion");
    const save = button("Guardar");

    await choose("anulada");
    expect(button("Guardar")).toBe(save);

    await choose("en_atencion");
    expect(button("Guardar")).toBe(save);
  });
});
