// @vitest-environment jsdom
import { act, createElement as h, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  OPERATION_KEY_FIELD,
  OperationKeyField,
} from "@/components/forms/operation-key-field";

// Clave de idempotencia de un formulario (D12 de la 11.2a, opcion B). La
// clave vive en sessionStorage por operacion y registro: recargar la pagina o
// remontar los campos tras un error la conserva, y solo cambia cuando el
// servidor confirma que la operacion con esa clave termino (completedKey).

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SCOPE = "pago_proveedor:COM00000003";
const STORAGE_KEY = `clave-operacion:${SCOPE}`;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});

/** Monta el campo bajo una key, como ActionForm remonta sus campos con cada respuesta. */
async function mount(key: string, props: { scope?: string; completedKey?: string } = {}) {
  await act(async () => {
    root.render(h(Fragment, { key }, h(OperationKeyField, { scope: SCOPE, ...props })));
  });

  const input = host.querySelector<HTMLInputElement>(`input[name="${OPERATION_KEY_FIELD}"]`);

  if (!input) {
    throw new Error("No se encontro el campo de la clave.");
  }

  return input;
}

describe("OperationKeyField", () => {
  it("es un campo oculto con una clave UUID guardada para su operacion y registro", async () => {
    const input = await mount("a");

    expect(input.type).toBe("hidden");
    expect(input.value).toMatch(UUID);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(input.value);
  });

  it("al remontarse sin una operacion terminada conserva la clave (error o recarga)", async () => {
    const first = (await mount("a")).value;
    const second = (await mount("b")).value;

    expect(second).toBe(first);
  });

  it("reusa la clave que dejo una carga anterior de la pagina", async () => {
    sessionStorage.setItem(STORAGE_KEY, "3f2b8c1e-9d4a-4b7e-8a6f-1c2d3e4f5a6b");

    expect((await mount("a")).value).toBe("3f2b8c1e-9d4a-4b7e-8a6f-1c2d3e4f5a6b");
  });

  it("cuando el servidor confirma la operacion con esa clave, genera otra para la siguiente", async () => {
    const first = (await mount("a")).value;
    const next = (await mount("b", { completedKey: first })).value;

    expect(next).toMatch(UUID);
    expect(next).not.toBe(first);
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe(next);
  });

  it("una confirmacion de otra clave no cambia la guardada", async () => {
    const first = (await mount("a")).value;

    expect((await mount("b", { completedKey: "0e5c7a9b-1111-4222-8333-444455556666" })).value).toBe(
      first,
    );
  });

  it("cada registro tiene su propia clave", async () => {
    const first = (await mount("a")).value;
    const other = (await mount("b", { scope: "pago_proveedor:COM00000004" })).value;

    expect(other).not.toBe(first);
  });

  // Hallazgo de la 11.2b (C3): con defaultValue="", React reescribia el valor del campo oculto
  // en cada render del padre y borraba la clave; el formulario de compra renderiza con cada
  // tecla, asi que enviaba la clave vacia.
  it("conserva la clave cuando el formulario se vuelve a renderizar sin remontarse", async () => {
    const first = (await mount("a")).value;

    await act(async () => {
      root.render(h(Fragment, { key: "a" }, h(OperationKeyField, { scope: SCOPE }), h("span", null, "otro render")));
    });

    const input = host.querySelector<HTMLInputElement>(`input[name="${OPERATION_KEY_FIELD}"]`);

    expect(input?.value).toBe(first);
  });

  it("sin sessionStorage disponible genera una clave por montaje", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });

    expect((await mount("a")).value).toMatch(UUID);
  });
});
