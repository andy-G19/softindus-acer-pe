// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import type { UserFormState } from "@/modules/users/actions";
import { usersNotifications } from "@/modules/users/notifications";
import { UserForm } from "@/modules/users/user-form";

// Formulario de usuarios con React real (entrega 10.7b). La accion devuelve un
// resultado en lugar de redirigir: con error se conserva lo escrito, salvo las
// contrasenas, que nunca vuelven del servidor (D6), y el mensaje queda dentro del
// formulario sin toast; con exito hay un solo aviso y se vuelve al returnTo. La
// edicion no tiene Estado (D2) y el administrador ve su propio rol como texto.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn(), showError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/users/new",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/notifications", () => notifications);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

// jsdom no trae ResizeObserver y el cuerpo del panel lo usa.
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

const LIST = "/dashboard/users";
const NEW_VALUES = { nombres: "", apellidos: "", usuario: "", correo: "", rol: "SELLER" };
const EDIT_VALUES = {
  id_usuario: "USU00000002",
  nombres: "Ana",
  apellidos: "Quispe",
  usuario: "aquispe",
  correo: "ana.quispe@example.com",
  rol: "WORKSHOP_MASTER",
};

function field<T extends HTMLElement>(id: string) {
  const element = document.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`No hay campo ${id}`);
  }
  return element;
}

const button = (text: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;

type Respond = (formData: FormData) => UserFormState;

// Lo que devuelve la accion real: los campos de texto, nunca las contrasenas.
const valuesOf = (formData: FormData) => ({
  nombres: String(formData.get("nombres")),
  apellidos: String(formData.get("apellidos")),
  usuario: String(formData.get("usuario")),
  correo: String(formData.get("correo")),
  rol: String(formData.get("rol")),
});

const success: Respond = (formData) => ({
  status: "success",
  data: { id_usuario: "USU00000012" },
  values: valuesOf(formData),
  operationId: "op-ok",
});

function formProps(respond: Respond, overrides: Record<string, unknown> = {}) {
  const action = vi.fn(async (_prev: UserFormState, formData: FormData) => respond(formData));

  return {
    action,
    props: {
      action,
      defaultValues: { ...NEW_VALUES, nombres: "Ana", apellidos: "Quispe", usuario: "aquispe", correo: "ana@example.com" },
      submitLabel: "Registrar usuario",
      successNotification: usersNotifications["user-created"],
      returnTo: LIST,
      ...overrides,
    },
  };
}

async function renderForm(respond: Respond, overrides: Record<string, unknown> = {}) {
  const { action, props } = formProps(respond, overrides);

  await act(async () => root.render(h(UserForm, props)));

  return action;
}

async function submit() {
  await act(async () => document.querySelector("form")!.requestSubmit());
}

// El alta exige las contrasenas: sin ellas el navegador no envia el formulario.
function fillPasswords() {
  field<HTMLInputElement>("password").value = "Clave#Segura1";
  field<HTMLInputElement>("confirmPassword").value = "Clave#Segura1";
}

function fillNewUser() {
  field<HTMLInputElement>("nombres").value = "Ana María";
  field<HTMLInputElement>("apellidos").value = "Quispe";
  field<HTMLInputElement>("usuario").value = "aquispe";
  field<HTMLInputElement>("correo").value = "ana@example.com";
  field<HTMLSelectElement>("rol").value = "WORKSHOP_MASTER";
  field<HTMLInputElement>("password").value = "Clave#Segura1";
  field<HTMLInputElement>("confirmPassword").value = "Clave#Segura2";
}

describe("UserForm", () => {
  it("con error conserva lo escrito y el rol, vacia las contrasenas, enfoca el campo y no da otro aviso", async () => {
    const message = "Las contraseñas no coinciden.";
    await renderForm((formData) => ({
      status: "error",
      error: "Revisa los datos del usuario.",
      fieldErrors: { confirmPassword: [message] },
      values: valuesOf(formData),
      operationId: "op-1",
    }));
    fillNewUser();

    await submit();

    expect(field<HTMLInputElement>("nombres").value).toBe("Ana María");
    expect(field<HTMLInputElement>("correo").value).toBe("ana@example.com");
    expect(field<HTMLSelectElement>("rol").value).toBe("WORKSHOP_MASTER");
    expect(field<HTMLInputElement>("password").value).toBe("");
    expect(field<HTMLInputElement>("confirmPassword").value).toBe("");
    expect(document.activeElement).toBe(field("confirmPassword"));
    expect(document.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos del usuario.");
    expect(field("confirmPassword-error").textContent).toBe(message);
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(notifications.showError).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    await renderForm(success);
    fillPasswords();

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith(usersNotifications["user-created"]);
    expect(navigation.push).toHaveBeenCalledWith(LIST);
  });

  it("si el listado tiene filtros, el aviso explica que el usuario puede no aparecer", async () => {
    await renderForm(success, { returnTo: `${LIST}?estado=inactivo` });
    fillPasswords();

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      ...usersNotifications["user-created"],
      description: "Puede no aparecer con los filtros activos del listado.",
    });
  });

  it("el alta pide contrasenas nuevas y el navegador no rellena usuario ni correo", async () => {
    await renderForm(success);

    expect(field<HTMLInputElement>("password").type).toBe("password");
    expect(field<HTMLInputElement>("password").autocomplete).toBe("new-password");
    expect(field<HTMLInputElement>("confirmPassword").autocomplete).toBe("new-password");
    expect(field<HTMLInputElement>("usuario").autocomplete).toBe("off");
    expect(field<HTMLInputElement>("correo").autocomplete).toBe("off");
    expect(document.querySelector('[name="estado"]')).toBeNull();
    expect([...document.querySelectorAll("a")].find((link) => link.textContent === "Cancelar")?.getAttribute("href")).toBe(LIST);
  });

  it("la edicion abre con los datos, envia su id y no tiene estado ni contrasenas", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      defaultValues: EDIT_VALUES,
      successNotification: usersNotifications["user-updated"],
    });

    expect(field<HTMLInputElement>("correo").value).toBe("ana.quispe@example.com");
    expect(field<HTMLSelectElement>("rol").value).toBe("WORKSHOP_MASTER");
    expect(document.querySelector('[name="estado"]')).toBeNull();
    expect(document.querySelector('[type="password"]')).toBeNull();

    await submit();

    expect((action.mock.calls[0]?.[1] as FormData).get("id_usuario")).toBe("USU00000002");
  });

  it("el administrador ve su propio rol como texto con su etiqueta y lo envia oculto", async () => {
    const action = await renderForm(success, {
      submitLabel: "Guardar cambios",
      defaultValues: { ...EDIT_VALUES, id_usuario: "USU00000001", rol: "ADMIN" },
      isSelf: true,
    });
    const rol = field<HTMLInputElement>("rol");
    const label = document.querySelector(`label[for="rol"]`);

    expect(rol.tagName).toBe("INPUT");
    expect(rol.readOnly).toBe(true);
    expect(rol.name).toBe("");
    expect(label?.textContent).toContain("Rol");
    expect(document.getElementById(rol.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "No puedes cambiar tu propio rol.",
    );

    await submit();

    expect((action.mock.calls[0]?.[1] as FormData).get("rol")).toBe("ADMIN");
  });
});

describe("UserForm en el panel lateral", () => {
  async function renderInPanel(respond: Respond) {
    const { props } = formProps(respond, { returnTo: `${LIST}?q=ana` });

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nuevo usuario",
          discardTitle: "¿Descartar el usuario nuevo?",
          discardDescription: "Se perderán los datos que escribiste en este panel.",
          children: h(UserForm, props),
        }),
      ),
    );
  }

  it("Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(success);

    expect([...document.querySelectorAll("a")].some((link) => link.textContent === "Cancelar")).toBe(false);

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("con una contrasena escrita, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(success);
    const password = field<HTMLInputElement>("password");
    password.value = "Clave#Segura1";
    await act(async () => password.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar el usuario nuevo?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso y cierra volviendo atras sin confirmar", async () => {
    await renderInPanel(success);
    fillPasswords();
    await act(async () => field("nombres").dispatchEvent(new Event("input", { bubbles: true })));

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
