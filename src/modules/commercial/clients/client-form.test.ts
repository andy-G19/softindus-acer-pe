// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet } from "@/components/navigation/route-sheet";
import type { ClientFormState, ClientFormValues } from "@/modules/commercial/clients/actions";
import { ClientForm } from "@/modules/commercial/clients/client-form";
import { commercialNotifications } from "@/modules/commercial/notifications";

// Formulario de clientes con React real (entrega 9): la accion devuelve un
// resultado en lugar de redirigir, y el formulario decide. Con error conserva
// lo escrito, enfoca el primer campo invalido y muestra el error dentro del
// formulario sin un segundo aviso; con exito da un solo aviso y vuelve al
// returnTo que valido la pagina.

const navigation = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), forward: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  usePathname: () => "/dashboard/commercial/clients/new",
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
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

function field<T extends HTMLElement>(id: string) {
  const element = host.querySelector<T>(`#${id}`);
  if (!element) {
    throw new Error(`No hay campo ${id}`);
  }
  return element;
}

function valuesOf(formData: FormData) {
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)])) as ClientFormValues;
}

const LIST = "/dashboard/commercial/clients";

async function renderForm(respond: (values: ClientFormValues) => ClientFormState, returnTo = LIST) {
  const action = vi.fn(async (_prev: ClientFormState, formData: FormData) => respond(valuesOf(formData)));

  await act(async () =>
    root.render(
      h(ClientForm, {
        action,
        submitLabel: "Guardar cliente",
        successNotification: commercialNotifications["client-created"],
        returnTo,
      }),
    ),
  );

  return action;
}

async function submit() {
  await act(async () => host.querySelector("form")!.requestSubmit());
}

describe("ClientForm", () => {
  it("con error conserva lo escrito, enfoca el campo invalido y no da un segundo aviso", async () => {
    await renderForm((values) => ({
      status: "error",
      error: "Revisa los datos del cliente.",
      fieldErrors: { nombre_razon_social: ["El nombre o razón social es obligatorio."] },
      values,
      operationId: "op-1",
    }));
    field<HTMLSelectElement>("tipo_cliente").value = "ferreteria";
    field<HTMLInputElement>("nombre_razon_social").value = "A";
    field<HTMLInputElement>("correo").value = "compras@andina.pe";

    await submit();

    expect(field<HTMLSelectElement>("tipo_cliente").value).toBe("ferreteria");
    expect(field<HTMLInputElement>("nombre_razon_social").value).toBe("A");
    expect(field<HTMLInputElement>("correo").value).toBe("compras@andina.pe");
    expect(document.activeElement).toBe(field("nombre_razon_social"));
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Revisa los datos del cliente.");
    expect(field("nombre_razon_social-error").textContent).toBe("El nombre o razón social es obligatorio.");
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("con exito da un solo aviso y vuelve al returnTo", async () => {
    const returnTo = `${LIST}?page=2`;
    await renderForm((values) => ({ status: "success", data: { id_cliente: "CLI00000008" }, values, operationId: "op-2" }), returnTo);
    field<HTMLInputElement>("nombre_razon_social").value = "Ferreteria Andina SAC";

    await submit();

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledWith({ type: "success", message: "Cliente guardado correctamente" });
    expect(navigation.push).toHaveBeenCalledWith(returnTo);
  });

  it("si el listado tiene filtros, el aviso explica que el cliente puede no aparecer", async () => {
    const returnTo = `${LIST}?status=inactivo&page=2`;
    await renderForm((values) => ({ status: "success", data: { id_cliente: "CLI00000008" }, values, operationId: "op-3" }), returnTo);
    // Nombre es required: sin el, requestSubmit no envia (validacion nativa).
    field<HTMLInputElement>("nombre_razon_social").value = "Ferreteria Andina SAC";

    await submit();

    expect(notifications.notify).toHaveBeenCalledWith({
      type: "success",
      message: "Cliente guardado correctamente",
      description: "Puede no aparecer con los filtros activos del listado.",
    });
    expect(navigation.push).toHaveBeenCalledWith(returnTo);
  });

  it("Cancelar vuelve al returnTo sin enviar", async () => {
    const returnTo = `${LIST}?q=andina`;
    const action = await renderForm(() => ({ status: "idle" }), returnTo);
    const cancel = [...host.querySelectorAll("a")].find((link) => link.textContent === "Cancelar");

    expect(cancel?.getAttribute("href")).toBe(returnTo);
    expect(action).not.toHaveBeenCalled();
  });
});

// En el panel lateral (entrega 9): el mismo formulario dentro de un RouteSheet.
describe("ClientForm en el panel lateral", () => {
  async function renderInPanel(respond: (values: ClientFormValues) => ClientFormState) {
    const action = vi.fn(async (_prev: ClientFormState, formData: FormData) => respond(valuesOf(formData)));

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nuevo cliente",
          discardTitle: "¿Descartar el cliente nuevo?",
          discardDescription: "Se perderan los datos que escribiste en este panel.",
          children: h(ClientForm, {
            action,
            submitLabel: "Guardar cliente",
            successNotification: commercialNotifications["client-created"],
            returnTo: `${LIST}?page=2`,
          }),
        }),
      ),
    );

    return action;
  }

  const form = () => document.querySelector("form")!;
  const button = (text: string) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent?.trim() === text)!;

  it("el foco empieza en el primer campo y Cancelar es un boton que cierra el panel", async () => {
    await renderInPanel(() => ({ status: "idle" }));

    expect(document.activeElement?.id).toBe("tipo_cliente");
    expect(document.querySelector("a")).toBeNull();

    await act(async () => button("Cancelar").click());
    expect(navigation.back).toHaveBeenCalledTimes(1);
  });

  it("con cambios, Cancelar pide confirmar el descarte", async () => {
    await renderInPanel(() => ({ status: "idle" }));
    const nombre = document.querySelector<HTMLInputElement>("#nombre_razon_social")!;
    nombre.value = "Andina";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => button("Cancelar").click());

    expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("¿Descartar el cliente nuevo?");
    expect(navigation.back).not.toHaveBeenCalled();
  });

  it("al guardar da un solo aviso, cierra volviendo atras sin confirmar y refresca la lista al volver", async () => {
    await renderInPanel((values) => ({ status: "success", data: { id_cliente: "CLI00000008" }, values, operationId: "op-9" }));
    const nombre = document.querySelector<HTMLInputElement>("#nombre_razon_social")!;
    nombre.value = "Ferreteria Andina SAC";
    await act(async () => nombre.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => form().requestSubmit());

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(navigation.back).toHaveBeenCalledTimes(1);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();

    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(navigation.refresh).toHaveBeenCalledTimes(1);
  });

  it("con error el panel sigue abierto con lo escrito y el foco en el campo invalido", async () => {
    await renderInPanel((values) => ({
      status: "error",
      error: "Ya existe un cliente con ese número de documento.",
      fieldErrors: { numero_documento: ["Ya existe un cliente con ese número de documento."] },
      values,
      operationId: "op-10",
    }));
    document.querySelector<HTMLInputElement>("#nombre_razon_social")!.value = "Ferreteria Andina SAC";
    document.querySelector<HTMLInputElement>("#numero_documento")!.value = "20123456789";

    await act(async () => form().requestSubmit());

    expect(navigation.back).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector<HTMLInputElement>("#numero_documento")!.value).toBe("20123456789");
    expect(document.activeElement?.id).toBe("numero_documento");
  });

  it("mientras guarda, el panel no se cierra", async () => {
    let finish: (state: ClientFormState) => void = () => {};
    const action = vi.fn(() => new Promise<ClientFormState>((resolve) => (finish = resolve)));

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nuevo cliente",
          discardTitle: "¿Descartar el cliente nuevo?",
          discardDescription: "Se perderan los datos que escribiste en este panel.",
          children: h(ClientForm, {
            action,
            submitLabel: "Guardar cliente",
            successNotification: commercialNotifications["client-created"],
            returnTo: LIST,
          }),
        }),
      ),
    );
    document.querySelector<HTMLInputElement>("#nombre_razon_social")!.value = "Ferreteria Andina SAC";

    await act(async () => form().requestSubmit());
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click());

    expect(navigation.back).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    await act(async () => finish({ status: "idle" }));
  });
});
