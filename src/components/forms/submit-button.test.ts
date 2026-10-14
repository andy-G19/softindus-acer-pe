import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";

// SubmitButton (entrega 8) es Button con type="submit" y el pending que da
// useFormStatus. El estado pendiente real solo existe en el navegador, durante
// la accion de un <form>: aqui se simula el hook y se exige que el HTML sea el
// mismo que el de Button con ese estado.

const formStatus = vi.hoisted(() => ({ pending: false }));

vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  useFormStatus: () => ({ pending: formStatus.pending, data: null, method: null, action: null }),
}));

afterEach(() => {
  formStatus.pending = false;
});

describe("SubmitButton", () => {
  it("en reposo es un Button de envio", () => {
    expect(renderToStaticMarkup(h(SubmitButton, { className: "w-full" }, "Guardar"))).toBe(
      renderToStaticMarkup(h(Button, { type: "submit", className: "w-full" }, "Guardar")),
    );
  });

  it("toma el estado pendiente del formulario", () => {
    formStatus.pending = true;

    expect(renderToStaticMarkup(h(SubmitButton, { pendingText: "Guardando..." }, "Guardar"))).toBe(
      renderToStaticMarkup(h(Button, { type: "submit", pending: true, pendingText: "Guardando..." }, "Guardar")),
    );
  });

  it("conserva disabled cuando no esta pendiente", () => {
    expect(renderToStaticMarkup(h(SubmitButton, { disabled: true }, "Guardar"))).toBe(
      renderToStaticMarkup(h(Button, { type: "submit", disabled: true }, "Guardar")),
    );
  });

  it("los tamanos de solo icono siguen exigiendo aria-label", () => {
    // Comprobacion de tipos: la verifica typecheck, no la ejecucion.
    // @ts-expect-error: un boton de solo icono necesita un nombre accesible
    expect(() => h(SubmitButton, { size: "icon" })).not.toThrow();
  });
});
