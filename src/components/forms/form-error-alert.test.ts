import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormErrorAlert, REPEATED_FIELD_MESSAGE } from "@/components/forms/form-error-alert";

// C1 de la 11.7d2 (D111, hallazgo 12 de la 10.3b): la alerta general de un formulario de la pista
// B repetia el error del campo cuando la accion mandaba el mismo texto arriba y en el campo (un
// documento repetido, un nombre que ya existe). Se veia dos veces y el lector de pantalla lo leia
// dos veces: la alerta (role="alert") y el campo que ActionForm enfoca. Ahora, si el mensaje
// general es el de un campo, la alerta dice que hay campos que revisar; si es otro (permisos,
// stock, base de datos, «Revisa los datos del…»), lo muestra tal cual.

const repetido = "Ya existe un cliente con ese documento.";

function render(state: Parameters<typeof FormErrorAlert>[0]["state"], className?: string) {
  return renderToStaticMarkup(h(FormErrorAlert, { state, className }));
}

describe("FormErrorAlert", () => {
  it("sin error no pinta nada", () => {
    expect(render({ status: "idle" })).toBe("");
    expect(render({ status: "success" })).toBe("");
  });

  it("muestra el mensaje general cuando no repite el de un campo", () => {
    const html = render({
      status: "error",
      error: "Revisa los datos del cliente.",
      fieldErrors: { numero_documento: ["El documento debe tener 8 digitos."] },
    });

    expect(html).toContain("Revisa los datos del cliente.");
    expect(html).not.toContain(REPEATED_FIELD_MESSAGE);
  });

  it("sin errores de campo muestra el mensaje general", () => {
    expect(render({ status: "error", error: "No tienes permisos para registrar clientes." })).toContain(
      "No tienes permisos para registrar clientes.",
    );
  });

  it("cuando repite el mensaje de un campo dice que hay campos que revisar", () => {
    const html = render({
      status: "error",
      error: repetido,
      fieldErrors: { nombre: [], numero_documento: [repetido] },
    });

    expect(REPEATED_FIELD_MESSAGE).toBe("Revisa los campos marcados.");
    expect(html).toContain(REPEATED_FIELD_MESSAGE);
    expect(html).not.toContain(repetido);
  });

  it("conserva el anuncio de la alerta y la clase que recibe", () => {
    const html = render({ status: "error", error: "Algo fallo." }, "mt-4");

    expect(html).toMatch(/role="alert"/);
    expect(html).toMatch(/aria-live="polite"/);
    expect(html).toMatch(/class="[^"]*\bmt-4\b/);
  });
});

// C2 de la 11.7d2: los formularios pintan su error con FormErrorAlert. Una copia nueva del bloque
// de antes (la alerta con `state.error` tal cual) volveria a repetir el mensaje de un campo.
describe("C2 de la 11.7d2: ningun formulario pinta state.error en una alerta propia", () => {
  it("no queda ninguna copia del bloque de antes", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const archivos = readdirSync("src", { recursive: true, encoding: "utf8" }).filter(
      (f) => f.endsWith(".tsx") && !f.includes("generated"),
    );
    const copias = archivos.filter((f) =>
      /<AlertDescription>\s*\{state\.error\}\s*<\/AlertDescription>/.test(readFileSync(`src/${f}`, "utf8")),
    );

    expect(copias).toEqual([]);
  });
});
