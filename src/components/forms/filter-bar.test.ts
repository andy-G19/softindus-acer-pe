// @vitest-environment jsdom
import { act, createElement as h, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilterBar } from "@/components/forms/filter-bar";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

// FilterBar en el navegador (entrega 10.3, hallazgo 10 de la 10.2). «Limpiar»,
// Atras y Adelante cambian la URL con next/link y Next vuelve a pintar la
// pagina sin montarla: aqui, un segundo render con la URL nueva y los valores
// que la pagina lee de ella. React actualiza el defaultValue de un input que
// el usuario no toco, pero un select solo lo lee al montarse, y un campo
// escrito sin enviar conserva lo escrito: los campos deben mostrar los filtros
// de la URL.
//
// La URL tambien cambia sin que lleguen campos nuevos (verificacion de la
// 10.3a en staging): Atras y Adelante confirman la URL con la pagina que ya se
// ve y luego llega la de la URL restaurada, y el panel de una ruta
// interceptada cambia la URL con la lista debajo. Aqui, changeUrl.

const url = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(url.search),
  usePathname: () => AUDIT,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const AUDIT = "/dashboard/audit";

let host: HTMLDivElement;
let root: Root;
// Los campos de la ultima pagina que pinto el servidor.
let fields: ReactNode = null;

beforeEach(() => {
  url.search = "";
  fields = null;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

// La pagina pinta la barra con los valores que lee de la URL.
async function renderBar(search: string) {
  const params = new URLSearchParams(search);
  fields = h(
    "div",
    null,
    h(Input, { id: "q", name: "q", defaultValue: params.get("q") ?? "" }),
    h(
      NativeSelect,
      { id: "accion", name: "accion", defaultValue: params.get("accion") ?? "" },
      h("option", { value: "" }, "Todas"),
      h("option", { value: "crear" }, "crear"),
      h("option", { value: "editar" }, "editar"),
    ),
  );

  await changeUrl(search);
}

// La URL cambia y la barra se vuelve a pintar con los campos que ya tenia.
async function changeUrl(search: string) {
  url.search = search;

  await act(async () =>
    root.render(
      h(FilterBar, {
        action: AUDIT,
        label: "Filtros de la bitacora",
        clearHref: AUDIT,
        clearLabel: "Limpiar",
        children: fields,
      }),
    ),
  );
}

function control<T extends HTMLElement>(selector: string) {
  const element = host.querySelector<T>(selector);
  if (!element) {
    throw new Error(`No hay ${selector}`);
  }
  return element;
}

const select = () => control<HTMLSelectElement>('select[name="accion"]');
const search = () => control<HTMLInputElement>('input[name="q"]');

// Lo que hace el navegador cuando el usuario escribe o elige: React escucha el
// evento y lee el valor con el setter nativo.
async function choose(element: HTMLInputElement | HTMLSelectElement, value: string, event: "input" | "change") {
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setValue = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  await act(async () => {
    setValue?.call(element, value);
    element.dispatchEvent(new Event(event, { bubbles: true }));
  });
}

describe("FilterBar al navegar sin recargar", () => {
  it("un select toma el valor de la URL tras Limpiar, y Atras se lo devuelve", async () => {
    await renderBar("accion=crear");
    expect(select().value).toBe("crear");

    await renderBar("");
    expect(select().value).toBe("");

    await renderBar("accion=crear");
    expect(select().value).toBe("crear");
  });

  it("un texto escrito sin enviar vuelve al de la URL cuando la URL cambia", async () => {
    await renderBar("q=acero");
    await choose(search(), "acero inoxidable", "input");
    expect(search().value).toBe("acero inoxidable");

    await renderBar("");

    expect(search().value).toBe("");
  });

  it("sin cambiar la URL, conserva lo que el usuario eligio y no envio", async () => {
    await renderBar("accion=crear");
    await choose(select(), "editar", "change");

    await renderBar("accion=crear");

    expect(select().value).toBe("editar");
  });

  it("los botones no se vuelven a montar: Limpiar conserva el foco", async () => {
    await renderBar("accion=crear");
    const clear = control<HTMLAnchorElement>("a");
    const submit = control<HTMLButtonElement>('button[type="submit"]');
    clear.focus();

    await renderBar("");

    expect(control<HTMLAnchorElement>("a")).toBe(clear);
    expect(control<HTMLButtonElement>('button[type="submit"]')).toBe(submit);
    expect(document.activeElement).toBe(clear);
  });
});

describe("FilterBar cuando la URL cambia antes que los campos", () => {
  it("Atras tras Limpiar: el select termina en el filtro de la URL", async () => {
    await renderBar("accion=crear");
    await renderBar("");

    await changeUrl("accion=crear");
    // Mientras llega la pagina, la barra es la de la lista que se ve.
    expect(select().value).toBe("");

    await renderBar("accion=crear");
    expect(select().value).toBe("crear");
  });

  it("Adelante: el select vuelve a quedar vacio", async () => {
    await renderBar("accion=crear");
    await renderBar("");
    await changeUrl("accion=crear");
    await renderBar("accion=crear");

    await changeUrl("");
    expect(select().value).toBe("crear");

    await renderBar("");
    expect(select().value).toBe("");
  });

  it("abrir y cerrar el panel conserva lo elegido sin enviar", async () => {
    await renderBar("accion=crear");
    await choose(select(), "editar", "change");

    await changeUrl("returnTo=%2Fdashboard%2Faudit%3Faccion%3Dcrear");
    expect(select().value).toBe("editar");

    await changeUrl("accion=crear");
    expect(select().value).toBe("editar");

    // Despues de guardar, el panel pide la lista otra vez (router.refresh).
    await renderBar("accion=crear");
    expect(select().value).toBe("editar");
  });
});
