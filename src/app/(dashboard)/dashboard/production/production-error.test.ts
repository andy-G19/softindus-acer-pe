// @vitest-environment jsdom
import { act, createElement as h, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProductionErrorPage from "./error";

// C5 de la 11.7b (D91): «Intentar nuevamente» llamaba a `reset`, que en Next 16 solo
// limpia el estado del error y vuelve a pintar lo que ya tenia el cliente, sin pedir
// los datos otra vez (node_modules/next/dist/client/components/error-boundary.js).
// Con un error del servidor, el boton volvia a mostrar el mismo error. `retry`
// (`unstable_retry` hasta Next 16.2) hace router.refresh() y luego reset: es lo que
// recomienda la guia de error.js.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
  retry: () => void;
};

const ErrorPage = ProductionErrorPage as ComponentType<ErrorPageProps>;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

function button(text: string) {
  const found = [...host.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === text,
  );

  if (!found) {
    throw new Error(`No hay boton «${text}»`);
  }

  return found;
}

describe("C5 de la 11.7b: reintentar el error de Produccion", () => {
  it("«Intentar nuevamente» vuelve a pedir los datos con retry, no con reset", async () => {
    const reset = vi.fn();
    const retry = vi.fn();

    await act(async () => {
      root.render(
        h(ErrorPage, {
          error: Object.assign(new Error("fallo"), { digest: "123" }),
          reset,
          retry,
        }),
      );
    });

    await act(async () => {
      button("Intentar nuevamente").click();
    });

    expect(retry).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });
});
