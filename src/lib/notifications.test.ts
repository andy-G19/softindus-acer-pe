import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeModal,
  showConfirm,
  showDeleteConfirm,
  showError,
  showInfo,
  showLoading,
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
// Se ejecuta la fachada real con react-toastify y sweetalert2 simulados: el
// snapshot fija, para cada funcion, que metodo de la libreria se llama, el
// HTML del contenido del toast con sus clases y las opciones exactas del
// toast o de la ventana de SweetAlert2 (textos, botones, icono y clases).

vi.mock("react-toastify", async () =>
  (await import("@/testing/notification-doubles")).toastifyModuleMock(),
);
vi.mock("sweetalert2", async () =>
  (await import("@/testing/notification-doubles")).sweetAlertModuleMock(),
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

describe("showConfirm", () => {
  it("usa los textos por defecto y devuelve la respuesta del usuario", async () => {
    await expect(showConfirm()).resolves.toBe(true);

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it("con textos propios y destructiva marca el boton de confirmar", async () => {
    await expect(
      showConfirm({
        title: "¿Anular proforma?",
        text: "Esta acción anulará la proforma y no se puede deshacer.",
        confirmText: "Confirmar anulación",
        cancelText: "Volver",
        icon: "warning",
        destructive: true,
      }),
    ).resolves.toBe(true);

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it("no destructiva y con otro icono", async () => {
    await showConfirm({ title: "¿Continuar?", icon: "question", destructive: false });

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it("devuelve false cuando el usuario cancela", async () => {
    resetNotificationDoubles(false);

    await expect(showConfirm()).resolves.toBe(false);
  });
});

describe("showDeleteConfirm", () => {
  it("sin entidad nombra un registro", async () => {
    await expect(showDeleteConfirm()).resolves.toBe(true);

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it("nombra la entidad recibida", async () => {
    resetNotificationDoubles(false);

    await expect(showDeleteConfirm("proforma")).resolves.toBe(false);

    expect(takeNotificationCalls()).toMatchSnapshot();
  });
});

describe("showLoading y closeModal", () => {
  it("showLoading abre una ventana sin botones que muestra el indicador al abrirse", () => {
    showLoading();

    const calls = takeNotificationCalls();
    expect(calls).toMatchSnapshot();

    const [fire] = calls;
    const options = (fire as { options: { didOpen: () => void } }).options;
    options.didOpen();

    expect(takeNotificationCalls()).toEqual([{ swal: "showLoading" }]);
  });

  it("showLoading con titulo y texto propios", () => {
    showLoading("Generando planilla", "No cierre la ventana.");

    expect(takeNotificationCalls()).toMatchSnapshot();
  });

  it("closeModal cierra la ventana de SweetAlert2", () => {
    closeModal();

    expect(takeNotificationCalls()).toEqual([{ swal: "close" }]);
  });
});
