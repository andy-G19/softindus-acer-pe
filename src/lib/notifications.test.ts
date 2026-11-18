import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NotificationDefinition } from "@/lib/notification-catalog";
import {
  notify,
  showError,
  showInfo,
  showSuccess,
  showWarning,
} from "@/lib/notifications";
import {
  resetNotificationDoubles,
  takeNotificationCalls,
} from "@/testing/notification-doubles";

// Caracterizacion de la fachada de notificaciones (entrega 7), escrita antes
// de sacar el catalogo del puente ?toast= y de agregar notify.
//
// Se ejecuta la fachada real con react-toastify simulado: el snapshot fija,
// para cada funcion, que metodo de la libreria se llama, el HTML del contenido
// del toast con sus clases y sus opciones exactas. Las confirmaciones y la
// ventana de carga de SweetAlert2 se retiraron en la 11.7a, con sus casos.

vi.mock("react-toastify", async () =>
  (await import("@/testing/notification-doubles")).toastifyModuleMock(),
);

beforeEach(() => {
  resetNotificationDoubles();
});

const toastFunctions = [
  ["showSuccess", showSuccess],
  ["showError", showError],
  ["showWarning", showWarning],
  ["showInfo", showInfo],
] as const;

describe("toasts", () => {
  it.each(toastFunctions)("%s con mensaje y descripcion", (_name, show) => {
    show("Mensaje de prueba", "Descripcion de prueba");

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it.each(toastFunctions)("%s solo con mensaje", (_name, show) => {
    show("Mensaje de prueba");

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it("una descripcion vacia no agrega el segundo parrafo", () => {
    showError("No se pudo iniciar sesion", "");

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  // Los formularios muestran state.error, que viene del servidor.
  it("escapa el HTML del mensaje y de la descripcion", () => {
    showError("Error <b>grave</b> & total", "<img src=x onerror=alert(1)>");

    expect(takeNotificationCalls()).toMatchSnapshot();
  });
});

// Hasta el grupo 3 de fixes este caso lo cubrian los casos F2 del puente
// ?toast=, que pasaban a notify lo que heredaba el registro de Object.
describe("notify", () => {
  it("una severidad fuera del contrato se muestra como info", () => {
    const definition = {
      type: "otro",
      message: "Mensaje de prueba",
      description: "Descripcion de prueba",
    } as unknown as NotificationDefinition;

    notify(definition);
    const calls = takeNotificationCalls();
    showInfo("Mensaje de prueba", "Descripcion de prueba");

    expect(calls).toEqual(takeNotificationCalls());
  });
});
