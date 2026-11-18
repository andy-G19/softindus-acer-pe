import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ProductionErrorPage from "./error";
import ProductionLoadingPage from "./loading";
import ProductionNotFoundPage from "./not-found";

// C4 de la 11.7b (D89): el error, la carga y el «no encontrado» de Produccion se
// pintan en el lugar de la pagina, dentro del <main> del shell
// (dashboard-shell.tsx). Abrian otro main adentro; su contenedor pasa a ser un <div>.

const error = Object.assign(new Error("fallo de prueba"), { digest: "123" });

const boundaries: [string, () => string, string][] = [
  [
    "error.tsx",
    () =>
      renderToStaticMarkup(
        createElement(ProductionErrorPage as ComponentType<Record<string, unknown>>, {
          error,
          reset: () => {},
          unstable_retry: () => {},
        }),
      ),
    "Ocurrió un problema en Producción",
  ],
  [
    "loading.tsx",
    () => renderToStaticMarkup(createElement(ProductionLoadingPage)),
    "animate-pulse",
  ],
  [
    "not-found.tsx",
    () => renderToStaticMarkup(createElement(ProductionNotFoundPage)),
    "Registro de producción no encontrado",
  ],
];

describe("C4 de la 11.7b: archivos de ruta de Produccion sin un main anidado", () => {
  it.each(boundaries)("%s no abre otro main", (_name, render, content) => {
    const html = render();

    expect(html).not.toContain("<main");
    expect(html).toContain(content);
  });
});
