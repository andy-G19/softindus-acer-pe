// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
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

function field(name: "from" | "to", inside: HTMLElement = host) {
  const input = inside.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) {
    throw new Error(`No hay campo ${name}`);
  }
  return input;
}

// Lo que hace el navegador cuando el usuario elige una fecha: React escucha el
// evento input y lee el valor con el setter nativo.
async function typeDate(name: "from" | "to", value: string, inside: HTMLElement = host) {
  const input = field(name, inside);
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

// Fechas elegidas antes de hidratar (hallazgo 9 de la 10.3c, D7 de la 10.4).
// El servidor pinta los campos y el usuario elige fechas antes de que llegue
// el JavaScript: el DOM cambia y React todavia no escucha. React hidrata sin
// pisar el valor del DOM, pero si el estado no lo toma, el siguiente render
// vuelve a escribir el estado en el campo y el rango no se valida.
describe("DateRangeFields con fechas elegidas antes de hidratar", () => {
  let serverHost: HTMLDivElement;
  let hydrated: Root | undefined;

  afterEach(async () => {
    const current = hydrated;
    hydrated = undefined;

    if (current) {
      await act(async () => current.unmount());
    }

    serverHost.remove();
  });

  async function chooseBeforeHydrating(
    defaults: { defaultFrom?: string; defaultTo?: string },
    chosen: { from?: string; to?: string },
  ) {
    const element = h(DateRangeFields, { id: "rango", ...defaults });
    serverHost = document.createElement("div");
    serverHost.innerHTML = renderToString(element);
    document.body.append(serverHost);

    if (chosen.from !== undefined) {
      field("from", serverHost).value = chosen.from;
    }

    if (chosen.to !== undefined) {
      field("to", serverHost).value = chosen.to;
    }

    await act(async () => {
      hydrated = hydrateRoot(serverHost, element);
    });
  }

  async function renderAgain(defaults: { defaultFrom?: string; defaultTo?: string }) {
    await act(async () => hydrated?.render(h(DateRangeFields, { id: "rango", ...defaults })));
  }

  it("conserva las fechas al volver a pintar con la misma URL y marca el rango invertido", async () => {
    await chooseBeforeHydrating({}, { from: "2026-07-31", to: "2026-07-01" });

    await renderAgain({});

    expect([field("from", serverHost).value, field("to", serverHost).value]).toEqual([
      "2026-07-31",
      "2026-07-01",
    ]);
    expect(field("to", serverHost).getAttribute("aria-invalid")).toBe("true");
    expect(field("to", serverHost).validationMessage).toBe(DATE_RANGE_INVERTED_MESSAGE);
  });

  it("elegir despues la otra fecha no borra la primera", async () => {
    await chooseBeforeHydrating({ defaultFrom: "2026-07-01" }, { from: "2026-07-10" });

    await typeDate("to", "2026-07-20", serverHost);

    expect([field("from", serverHost).value, field("to", serverHost).value]).toEqual([
      "2026-07-10",
      "2026-07-20",
    ]);
    expect(field("to", serverHost).getAttribute("min")).toBe("2026-07-10");
  });

  it("sin nada elegido, hidrata con las fechas de la URL", async () => {
    await chooseBeforeHydrating({ defaultFrom: "2026-07-01", defaultTo: "2026-07-31" }, {});

    await renderAgain({ defaultFrom: "2026-07-01", defaultTo: "2026-07-31" });

    expect([field("from", serverHost).value, field("to", serverHost).value]).toEqual([
      "2026-07-01",
      "2026-07-31",
    ]);
    expect(field("to", serverHost).getAttribute("min")).toBe("2026-07-01");
    expect(field("to", serverHost).hasAttribute("aria-invalid")).toBe(false);
  });

  it("si despues cambia la URL (Limpiar), los campos toman la URL", async () => {
    await chooseBeforeHydrating({}, { from: "2026-07-31", to: "2026-07-01" });

    await renderAgain({ defaultFrom: "2026-08-01", defaultTo: "2026-08-15" });

    expect([field("from", serverHost).value, field("to", serverHost).value]).toEqual([
      "2026-08-01",
      "2026-08-15",
    ]);
    expect(field("to", serverHost).hasAttribute("aria-invalid")).toBe(false);
  });
});
