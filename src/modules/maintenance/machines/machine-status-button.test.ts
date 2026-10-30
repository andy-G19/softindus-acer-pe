// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatusToggleState } from "@/lib/requested-status";
import { MachineStatusButton } from "@/modules/maintenance/machines/machine-status-button";

// Activar e inactivar una maquina desde su fila (entrega 10.5a), con el Radix
// real: el snapshot de la pagina no distingue un boton con confirmacion de uno
// sin ella. Inactivar confirma con el nombre y la consecuencia, desde
// cualquier estado que no sea inactiva; activar se ejecuta al pulsar; los dos
// envian el estado pedido. Un error de la accion queda dentro de la
// confirmacion.

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

const confirmation = () => document.querySelector('[role="alertdialog"]');

const ACTIVATED = { type: "success" as const, message: "Máquina activada" };
const DEACTIVATED = { type: "warning" as const, message: "Máquina desactivada" };

type Respond = (formData: FormData) => StatusToggleState;

const succeed: Respond = (formData) => ({
  status: "success",
  data: { estado: formData.get("estado") === "true" },
  values: { id: String(formData.get("id_maquina")) },
  operationId: crypto.randomUUID(),
});

async function renderButton(estado: string, respond: Respond = succeed) {
  const action = vi.fn(async (_prev: StatusToggleState, formData: FormData) => respond(formData));

  await act(async () =>
    root.render(
      h(MachineStatusButton, {
        machine: { id_maquina: "MAQ00000004", nombre: "Prensa hidráulica 60 t", estado },
        action,
        activatedNotification: ACTIVATED,
        deactivatedNotification: DEACTIVATED,
      }),
    ),
  );

  return action;
}

function buttonIn(scope: ParentNode, text: string) {
  return [...scope.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text);
}

describe("MachineStatusButton", () => {
  it("inactivar confirma con el nombre y la consecuencia y envia estado false", async () => {
    const action = await renderButton("operativa");

    await act(async () => buttonIn(document, "Inactivar")!.click());

    expect(confirmation()?.textContent).toContain("¿Inactivar la máquina Prensa hidráulica 60 t?");
    expect(confirmation()?.textContent).toContain(
      "No se podrán registrar fallas sobre ella ni asignarla a etapas de producción",
    );
    expect(confirmation()?.textContent).toContain("no contará como operativa en el inicio de Mantenimiento");
    expect(confirmation()?.textContent).toContain("Al activarla vuelve a quedar operativa.");
    expect(buttonIn(confirmation()!, "Inactivar")!.getAttribute("data-variant")).toBe("destructive");
    expect(action).not.toHaveBeenCalled();

    await act(async () => buttonIn(confirmation()!, "Inactivar")!.click());
    await settle();

    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_maquina: "MAQ00000004", estado: "false" });
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(DEACTIVATED);
    expect(confirmation()).toBeNull();
  });

  it.each(["en_reparacion", "dada_de_baja"])("una maquina %s tambien ofrece Inactivar", async (estado) => {
    await renderButton(estado);

    expect(buttonIn(document, "Inactivar")).toBeDefined();
    expect(buttonIn(document, "Activar")).toBeUndefined();
  });

  it("si otro ya la inactivo, el mensaje queda en la confirmacion sin aviso", async () => {
    await renderButton("operativa", (formData) => ({
      status: "error",
      error: "La máquina ya estaba inactiva.",
      values: { id: String(formData.get("id_maquina")) },
      operationId: crypto.randomUUID(),
    }));

    await act(async () => buttonIn(document, "Inactivar")!.click());
    await act(async () => buttonIn(confirmation()!, "Inactivar")!.click());
    await settle();

    expect(confirmation()?.textContent).toContain("La máquina ya estaba inactiva.");
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("activar una maquina inactiva se ejecuta al pulsar y envia estado true", async () => {
    const action = await renderButton("inactiva");

    expect(buttonIn(document, "Inactivar")).toBeUndefined();

    await act(async () => buttonIn(document, "Activar")!.click());
    await settle();

    expect(confirmation()).toBeNull();
    expect(Object.fromEntries(action.mock.calls[0][1])).toEqual({ id_maquina: "MAQ00000004", estado: "true" });
    expect(notifications.notify).toHaveBeenCalledWith(ACTIVATED);
  });
});
