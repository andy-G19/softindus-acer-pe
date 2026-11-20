// @vitest-environment jsdom
import { createElement as h } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NotificationProvider } from "@/components/notifications/notification-provider";
import { showError, showInfo, showSuccess, showWarning } from "@/lib/notifications";

// Avisos con la propuesta «Estados (mensajes temporales)» del responsable (2026-11-20): cada tipo
// muestra su simbolo de linea dentro de la insignia (check, circulo con «!», triangulo, «i»), en
// lugar de los iconos rellenos de toastify. Se renderiza el ToastContainer real.

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(h(NotificationProvider)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("NotificationProvider", () => {
  it.each([
    ["success", showSuccess],
    ["error", showError],
    ["warning", showWarning],
    ["info", showInfo],
  ] as const)("el aviso %s lleva el simbolo de la propuesta", async (tipo, show) => {
    await act(async () => {
      show("Mensaje de prueba");
    });

    const iconos = host.querySelectorAll(".Toastify__toast-icon svg");
    expect(iconos).toHaveLength(1);
    const icono = iconos[0];
    expect(icono?.getAttribute("data-slot")).toBe("toast-icon");
    expect(icono?.getAttribute("data-type")).toBe(tipo);
    expect(icono?.getAttribute("aria-hidden")).toBe("true");
    expect(icono?.getAttribute("stroke-width")).toBe("2.4");
  });
});
