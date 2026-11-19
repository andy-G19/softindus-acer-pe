// @vitest-environment jsdom
import { act, createElement as h, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  ErrorBoundaryHandler,
  type ErrorComponent,
} from "next/dist/client/components/error-boundary";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardErrorPage from "./error";
import ProductionErrorPage from "./production/error";

// Revisión de dependencias (C1): las pruebas de cada error.tsx le pasan las props a mano,
// así que no ven si Next deja de pasarlas. Next 16.3 estabilizó `retry` y quitó
// `unstable_retry`: con next 16.4.6, «Intentar nuevamente» llamaba a una función que no
// existe. Esta prueba monta el límite de error real de Next (el que envuelve cada segmento)
// con un hijo que falla, y exige que el botón vuelva a pedir los datos con `router.refresh`.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const errorPages: [string, ComponentType<never>][] = [
  ["panel", DashboardErrorPage],
  ["Producción", ProductionErrorPage],
];

function FailingSegment(): never {
  throw Object.assign(new Error("fallo del servidor"), { digest: "2914530184" });
}

let host: HTMLDivElement;
let root: Root;
let uncaught: unknown[];

function recordUncaught(event: ErrorEvent) {
  uncaught.push(event.error);
  event.preventDefault();
}

beforeEach(() => {
  uncaught = [];
  window.addEventListener("error", recordUncaught);
  // React informa por console.error el error que captura el límite: es el que provoca la prueba.
  vi.spyOn(console, "error").mockImplementation(() => {});
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  window.removeEventListener("error", recordUncaught);
  vi.restoreAllMocks();
});

describe("error.tsx con el límite de error real de Next", () => {
  it.each(errorPages)(
    "«Intentar nuevamente» del %s vuelve a pedir los datos con router.refresh",
    async (_area, errorPage) => {
      const router = { refresh: vi.fn() } as unknown as AppRouterInstance;

      await act(async () => {
        root.render(
          h(
            AppRouterContext.Provider,
            { value: router },
            h(
              ErrorBoundaryHandler,
              { pathname: "/dashboard", errorComponent: errorPage as unknown as ErrorComponent },
              h(FailingSegment),
            ),
          ),
        );
      });

      const retry = [...host.querySelectorAll("button")].find(
        (button) => button.textContent === "Intentar nuevamente",
      );
      expect(retry).toBeDefined();

      await act(async () => {
        retry?.click();
      });

      expect(uncaught).toEqual([]);
      expect(router.refresh).toHaveBeenCalledTimes(1);
    },
  );
});
