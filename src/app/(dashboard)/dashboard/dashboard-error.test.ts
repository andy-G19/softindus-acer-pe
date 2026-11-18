// @vitest-environment jsdom
import { act, createElement as h, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardErrorPage from "./error";

// C6 de la 11.7b (D90): fuera de Produccion, un error de una pagina del panel caia en la
// pantalla generica de Next, en ingles y sin el menu («This page couldn't load», T94 de
// la 10.7a). El error.tsx del segmento dashboard queda dentro de su layout, el del shell,
// asi que el error se pinta con el menu y la cabecera.
//
// En produccion Next cambia el mensaje de un error del servidor por un texto generico en
// ingles: la pantalla muestra el digest, que permite buscar el error en los registros, y
// nunca error.message, que en desarrollo podria mostrar detalles internos.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry: () => void;
};

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

async function renderError(error: Error & { digest?: string }) {
  const props = { error, reset: vi.fn(), unstable_retry: vi.fn() };

  await act(async () => {
    root.render(h(DashboardErrorPage as ComponentType<ErrorPageProps>, props));
  });

  return props;
}

const serverError = () =>
  Object.assign(new Error("relation aceros.cliente does not exist"), { digest: "2914530184" });

describe("C6 de la 11.7b: pantalla de error del panel", () => {
  it("da un titulo en espanol, el codigo de referencia y nunca el mensaje tecnico", async () => {
    await renderError(serverError());

    expect(host.querySelector("h1")?.textContent).toBe("Ocurrió un problema");
    expect(host.textContent).toContain("Código de referencia: 2914530184");
    expect(host.textContent).not.toContain("relation aceros.cliente");
  });

  it("sin digest no muestra un codigo vacio", async () => {
    await renderError(new Error("fallo en el navegador"));

    expect(host.textContent).not.toContain("Código de referencia");
    expect(host.textContent).not.toContain("fallo en el navegador");
  });

  it("se pinta dentro del main del shell, sin abrir otro", async () => {
    await renderError(serverError());

    expect(host.querySelector("main")).toBeNull();
  });

  it("«Intentar nuevamente» vuelve a pedir los datos con unstable_retry", async () => {
    const props = await renderError(serverError());
    const retry = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Intentar nuevamente",
    );

    await act(async () => {
      retry?.click();
    });

    expect(props.unstable_retry).toHaveBeenCalledTimes(1);
    expect(props.reset).not.toHaveBeenCalled();
  });

  it("ofrece volver al inicio del panel", async () => {
    await renderError(serverError());

    const link = [...host.querySelectorAll("a")].find(
      (anchor) => anchor.textContent === "Volver al inicio",
    );

    expect(link?.getAttribute("href")).toBe("/dashboard");
  });
});
