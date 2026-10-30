// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SearchableSelect } from "@/components/forms/searchable-select";

// SearchableSelect avisa de un cambio como un <select> nativo (hallazgo 1 de
// la 10.5a): elegir una opcion o limpiarla dispara un evento input que
// burbujea. RouteSheet y FormDialog marcan los cambios con el onInput de su
// contenido; sin el evento, elegir una opcion sin escribir no contaba como
// cambio y Cancelar cerraba el panel sin preguntar.

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

const ITEMS = [
  { id: "PVE00000001", label: "Aceros Arequipa" },
  { id: "PVE00000003", label: "Rodamientos del Sur" },
];

async function renderSelect(value = "") {
  const onInput = vi.fn();

  await act(async () =>
    root.render(
      h(
        "div",
        { onInput },
        h(SearchableSelect, { id: "id_proveedor", name: "id_proveedor", label: "Proveedor", items: ITEMS, value: undefined }),
      ),
    ),
  );

  if (value) {
    await choose(ITEMS.find((item) => item.id === value)!.label);
    onInput.mockClear();
  }

  return onInput;
}

const combobox = () => document.querySelector<HTMLInputElement>("#id_proveedor")!;
const hidden = () => document.querySelector<HTMLInputElement>('input[name="id_proveedor"]')!;
const option = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find((item) => item.textContent?.includes(label))!;

// La lista se abre al recibir el foco: si ya lo tiene (tras elegir), se quita antes.
async function open() {
  await act(async () => combobox().blur());
  await act(async () => combobox().focus());
}

async function choose(label: string) {
  await open();
  await act(async () => option(label).click());
}

describe("SearchableSelect avisa de los cambios con un evento input", () => {
  it("elegir una opcion con un clic dispara input y deja el valor", async () => {
    const onInput = await renderSelect();

    await choose("Rodamientos del Sur");

    expect(hidden().value).toBe("PVE00000003");
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it("elegir con Enter tambien lo dispara", async () => {
    const onInput = await renderSelect();
    await open();

    await act(async () =>
      combobox().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
    );

    expect(hidden().value).toBe("PVE00000001");
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it("Limpiar quita la opcion y dispara input", async () => {
    const onInput = await renderSelect("PVE00000001");
    const clear = [...document.querySelectorAll("button")].find((button) => button.textContent === "Limpiar")!;

    await act(async () => clear.click());

    expect(hidden().value).toBe("");
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it("volver a elegir la opcion que ya estaba no cuenta como cambio", async () => {
    const onInput = await renderSelect("PVE00000001");

    await choose("Aceros Arequipa");

    expect(hidden().value).toBe("PVE00000001");
    expect(onInput).not.toHaveBeenCalled();
  });
});
