// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResetPasswordFormState } from "@/modules/users/actions";
import { usersNotifications } from "@/modules/users/notifications";
import { ResetPasswordDialog } from "@/modules/users/reset-password-dialog";

// Restablecer la contrasena en ventana modal desde la fila (entrega 10.7b), con el
// Radix real. Sustituye a la pagina users/[id]/reset-password (D3). Las
// contrasenas nunca vuelven del servidor (D6) y el formulario solo existe mientras
// la ventana esta abierta: al cerrarla, lo escrito sale del DOM.

const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

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
  notifications.showError.mockClear();
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

const dialog = () => document.querySelector('[role="dialog"]');
const field = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const PASSWORD = "Clave#Segura1";

type Respond = (formData: FormData) => ResetPasswordFormState;

function actionWith(respond: Respond) {
  return vi.fn(async (_prev: ResetPasswordFormState, formData: FormData) => respond(formData));
}

const success: Respond = () => ({
  status: "success",
  data: { id_usuario: "USU00000002" },
  values: {},
  operationId: "op-ok",
});

async function renderDialog(action: ReturnType<typeof actionWith>) {
  await act(async () =>
    root.render(
      h(ResetPasswordDialog, {
        action,
        idUsuario: "USU00000002",
        nombre: "Ana Quispe",
        correo: "ana.quispe@example.com",
        successNotification: usersNotifications["user-password-reset"],
      }),
    ),
  );
}

async function open() {
  const trigger = button("Resetear contraseña");
  trigger.focus();
  await act(async () => trigger.click());

  return trigger;
}

function fill(confirmPassword = PASSWORD) {
  field<HTMLInputElement>("password").value = PASSWORD;
  field<HTMLInputElement>("confirmPassword").value = confirmPassword;
}

async function submit() {
  await act(async () => dialog()?.querySelector("form")?.requestSubmit());
  await settle();
}

describe("ResetPasswordDialog", () => {
  it("cerrada no tiene campos de contrasena; su boton la abre y nombra al usuario", async () => {
    await renderDialog(actionWith(success));

    expect(document.querySelector('[type="password"]')).toBeNull();

    await open();

    expect(dialog()?.textContent).toContain("Restablecer contraseña");
    expect(dialog()?.textContent).toContain("Ana Quispe · ana.quispe@example.com");
    expect(dialog()?.textContent).toContain("La contraseña anterior deja de funcionar de inmediato.");
    expect(dialog()?.textContent).toContain(
      "Las sesiones que este usuario ya tiene abiertas no se cierran. Para cerrarlas, desactívalo.",
    );
  });

  it("pide contrasenas nuevas y envia el usuario en un campo oculto", async () => {
    const action = actionWith(success);
    await renderDialog(action);
    await open();

    // Los dos campos ocultan lo que se escribe.
    expect(field<HTMLInputElement>("password").type).toBe("password");
    expect(field<HTMLInputElement>("confirmPassword").type).toBe("password");
    expect(field<HTMLInputElement>("password").autocomplete).toBe("new-password");
    expect(field<HTMLInputElement>("confirmPassword").autocomplete).toBe("new-password");

    fill();
    await submit();

    const formData = action.mock.calls[0]?.[1] as FormData;
    expect(formData.get("id_usuario")).toBe("USU00000002");
    expect(formData.get("password")).toBe(PASSWORD);
  });

  it("con error vacia las contrasenas, deja el mensaje en su campo y no da aviso", async () => {
    const message = "Las contraseñas no coinciden.";
    await renderDialog(
      actionWith(() => ({
        status: "error",
        error: "Revisa la contraseña ingresada.",
        fieldErrors: { confirmPassword: [message] },
        values: {},
        operationId: "op-1",
      })),
    );
    await open();
    fill("Otra#Clave1");

    await submit();

    expect(dialog()).not.toBeNull();
    expect(field<HTMLInputElement>("password").value).toBe("");
    expect(field<HTMLInputElement>("confirmPassword").value).toBe("");
    expect(field("confirmPassword-error").textContent).toBe(message);
    expect(document.activeElement).toBe(field("confirmPassword"));
    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toContain("Revisa la contraseña ingresada.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso, se cierra y lo escrito sale del DOM", async () => {
    await renderDialog(actionWith(success));
    await open();
    fill();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(usersNotifications["user-password-reset"]);
    expect(dialog()).toBeNull();
    expect(document.querySelector('[type="password"]')).toBeNull();
  });

  it("con una contrasena escrita, Cancelar pide confirmar el descarte", async () => {
    await renderDialog(actionWith(success));
    await open();
    const password = field<HTMLInputElement>("password");
    password.value = PASSWORD;
    await act(async () => password.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar la contraseña nueva?");
  });
});
