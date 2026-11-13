// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PettyCashBoxFormState } from "@/modules/petty-cash/boxes/actions";
import { PettyCashBoxForm } from "@/modules/petty-cash/boxes/box-form";

// Formulario para abrir una caja chica (C7 de la 11.4a) con React real: sin clave de operacion,
// lo que conserva tras un error (el nombre y el saldo, con el campo marcado y sin pagina de error)
// y lo que hace tras guardar (un aviso y vuelta al listado de cajas).

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/notifications", () => notifications);
vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const RETURN_TO = "/dashboard/petty-cash/boxes";
const NOTIFICATION = { type: "success", message: "Caja chica creada correctamente" } as const;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  sessionStorage.clear();
  notifications.notify.mockReset();
  notifications.showError.mockReset();
  router.push.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function control<T extends HTMLElement>(name: string) {
  const element = host.querySelector<T>(`[name="${name}"]`);

  if (!element) {
    throw new Error(`No hay ningun campo ${name}`);
  }

  return element;
}

const valuesOf = (formData: FormData) => ({
  nombre_caja: String(formData.get("nombre_caja") ?? ""),
  saldo_inicial: String(formData.get("saldo_inicial") ?? ""),
  fecha_apertura: String(formData.get("fecha_apertura") ?? ""),
  responsable: String(formData.get("responsable") ?? ""),
  observaciones: String(formData.get("observaciones") ?? ""),
});

async function render(respond: (formData: FormData) => PettyCashBoxFormState) {
  const received: FormData[] = [];
  const action = vi.fn(async (_prev: PettyCashBoxFormState, formData: FormData) => {
    received.push(formData);
    return respond(formData);
  });

  await act(async () => {
    root.render(
      h(PettyCashBoxForm, {
        action,
        defaultDate: "2026-11-12",
        returnTo: RETURN_TO,
        successNotification: NOTIFICATION,
      }),
    );
  });

  return received;
}

async function change(name: string, value: string) {
  const element = control<HTMLInputElement>(name);

  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// Estas pruebas miran como el formulario trata la respuesta del servidor, no las reglas del
// navegador (required).
async function fillAndSubmit() {
  await change("nombre_caja", "Caja almacen");
  await change("saldo_inicial", "250.40");
  await act(async () => {
    const form = host.querySelector("form");

    if (form) {
      form.noValidate = true;
      form.requestSubmit();
    }
  });
}

describe("PettyCashBoxForm", () => {
  it("propone la fecha que da la pagina y no envia clave de operacion", async () => {
    const received = await render((formData) => ({
      status: "error",
      error: "x",
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    expect(control<HTMLInputElement>("fecha_apertura").value).toBe("2026-11-12");

    await fillAndSubmit();

    expect(received[0].has("clave_operacion")).toBe(false);
  });

  it("tras un nombre repetido conserva lo escrito, marca el nombre y no da avisos", async () => {
    const message = "Ya existe una caja chica con ese nombre.";

    await render((formData) => ({
      status: "error",
      error: message,
      fieldErrors: { nombre_caja: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(control<HTMLInputElement>("nombre_caja").value).toBe("Caja almacen");
    expect(control<HTMLInputElement>("saldo_inicial").value).toBe("250.40");
    expect(control<HTMLInputElement>("nombre_caja").getAttribute("aria-invalid")).toBe("true");
    expect(host.textContent).toContain(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("tras guardar avisa una vez y vuelve al listado de cajas", async () => {
    await render((formData) => ({
      status: "success",
      data: { id_caja_chica: "CAJ00000004" },
      values: valuesOf(formData),
      operationId: "op-1",
    }));

    await fillAndSubmit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(NOTIFICATION);
    expect(router.push).toHaveBeenCalledWith(RETURN_TO);
  });
});
