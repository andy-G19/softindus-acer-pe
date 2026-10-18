// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DateRangeFields } from "@/components/forms/date-range-fields";
import { DATE_RANGE_INVERTED_MESSAGE } from "@/lib/date-range";

// DateRangeFields en el navegador (entrega 10.2). Next no vuelve a montar la
// pagina cuando la URL cambia con next/link (Limpiar, Atras, Adelante): la
// pagina vuelve a pintar el mismo componente con las fechas nuevas de la URL, y
// eso es lo que hace aqui un segundo render con otras props.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

async function renderRange(defaults: { defaultFrom?: string; defaultTo?: string }) {
  await act(async () => root.render(h(DateRangeFields, { id: "rango", ...defaults })));
}

function field(name: "from" | "to") {
  const input = host.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) {
    throw new Error(`No hay campo ${name}`);
  }
  return input;
}

// Lo que hace el navegador cuando el usuario elige una fecha: React escucha el
// evento input y lee el valor con el setter nativo.
async function typeDate(name: "from" | "to", value: string) {
  const input = field(name);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("DateRangeFields al navegar sin recargar", () => {
  it("si la URL queda sin fechas (Limpiar), los campos quedan vacios", async () => {
    await renderRange({ defaultFrom: "2026-07-01", defaultTo: "2026-07-31" });
    expect([field("from").value, field("to").value]).toEqual(["2026-07-01", "2026-07-31"]);

    await renderRange({});

    expect([field("from").value, field("to").value]).toEqual(["", ""]);
    expect(field("to").hasAttribute("min")).toBe(false);
  });

  it("toma cada extremo que cambia en la URL y deja el otro", async () => {
    await renderRange({ defaultFrom: "2026-07-01", defaultTo: "2026-07-31" });

    await renderRange({ defaultFrom: "2026-07-01", defaultTo: "2026-07-15" });
    expect([field("from").value, field("to").value]).toEqual(["2026-07-01", "2026-07-15"]);

    await renderRange({ defaultFrom: "2026-07-10", defaultTo: "2026-07-15" });
    expect([field("from").value, field("to").value]).toEqual(["2026-07-10", "2026-07-15"]);
    expect(field("to").getAttribute("min")).toBe("2026-07-10");
  });

  it("una fecha nueva de la URL que no existe empieza vacia y no cuenta para el rango", async () => {
    await renderRange({ defaultFrom: "2026-07-01", defaultTo: "2026-07-31" });

    await renderRange({ defaultFrom: "2026-02-30", defaultTo: "2026-02-10" });

    expect([field("from").value, field("to").value]).toEqual(["", "2026-02-10"]);
    expect(field("to").hasAttribute("min")).toBe(false);
    expect(field("to").hasAttribute("aria-invalid")).toBe(false);

    await renderRange({ defaultFrom: "2026-03-01", defaultTo: "2026-02-30" });

    expect([field("from").value, field("to").value]).toEqual(["2026-03-01", ""]);
    expect(field("to").hasAttribute("aria-invalid")).toBe(false);
  });

  it("si la URL pasa de un rango invertido a uno valido, Hasta deja de estar marcado", async () => {
    await renderRange({ defaultFrom: "2026-07-31", defaultTo: "2026-07-01" });
    expect(field("to").getAttribute("aria-invalid")).toBe("true");
    expect(field("to").validationMessage).toBe(DATE_RANGE_INVERTED_MESSAGE);

    await renderRange({ defaultFrom: "2026-07-01", defaultTo: "2026-07-31" });

    expect(field("to").hasAttribute("aria-invalid")).toBe(false);
    expect(field("to").validationMessage).toBe("");
    expect(host.textContent).not.toContain(DATE_RANGE_INVERTED_MESSAGE);
  });

  it("si la URL no cambia, conserva las fechas que eligio el usuario", async () => {
    await renderRange({ defaultFrom: "2026-07-01", defaultTo: "2026-07-31" });
    await typeDate("from", "2026-07-10");
    await typeDate("to", "2026-07-20");

    await renderRange({ defaultFrom: "2026-07-01", defaultTo: "2026-07-31" });

    expect([field("from").value, field("to").value]).toEqual(["2026-07-10", "2026-07-20"]);
  });
});
