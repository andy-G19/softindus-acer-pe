// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PointerSpotlight } from "@/components/ui/pointer-spotlight";

// Resplandor que sigue el puntero (propuesta de la presentacion, 2026-11-20; D157 y D158). Es una
// capa decorativa dentro de la tarjeta: escucha el movimiento del puntero sobre su anfitrion (el
// elemento .spotlight-host mas cercano, o su padre) y escribe en si misma la posicion en
// porcentaje (--spotlight-x, --spotlight-y). El CSS dibuja un circulo del color del anfitrion que solo se ve con el
// anfitrion bajo el puntero o con foco de teclado. KpiCard y ModuleAccessCard reciben icon, una
// funcion que no puede pasar a un componente de cliente: por eso el resplandor es un hijo
// pequeno de cliente y las tarjetas siguen siendo de servidor.

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mountNode: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mountNode = document.createElement("div");
  document.body.append(mountNode);
  root = createRoot(mountNode);
});

afterEach(() => {
  act(() => root.unmount());
  mountNode.remove();
  vi.restoreAllMocks();
});

function renderInHost(hostClass?: string) {
  act(() => {
    root.render(
      h("div", { className: hostClass, "data-testid": "host" }, h("div", { "data-testid": "inner" }, h(PointerSpotlight))),
    );
  });
  const host = mountNode.querySelector<HTMLElement>('[data-testid="host"]')!;
  const inner = mountNode.querySelector<HTMLElement>('[data-testid="inner"]')!;
  const spotlight = mountNode.querySelector<HTMLElement>('[data-slot="pointer-spotlight"]')!;
  return { host, inner, spotlight };
}

// jsdom no calcula el diseno: la caja del anfitrion se finge.
function fakeBox(element: HTMLElement) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    left: 100,
    top: 50,
    width: 200,
    height: 100,
    right: 300,
    bottom: 150,
    x: 100,
    y: 50,
    toJSON: () => ({}),
  });
}

function movePointer(target: HTMLElement, clientX: number, clientY: number) {
  act(() => {
    target.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX, clientY }));
  });
}

describe("PointerSpotlight", () => {
  it("en el servidor es una capa decorativa vacia, sin posicion", () => {
    const html = renderToStaticMarkup(h(PointerSpotlight));

    expect(html).toBe('<span data-slot="pointer-spotlight" aria-hidden="true" class="pointer-spotlight"></span>');
  });

  it("sin .spotlight-host sigue el puntero sobre su padre y escribe la posicion en porcentaje", () => {
    const { inner, spotlight } = renderInHost();
    fakeBox(inner);

    movePointer(inner, 150, 75);

    expect(spotlight.style.getPropertyValue("--spotlight-x")).toBe("25.0%");
    expect(spotlight.style.getPropertyValue("--spotlight-y")).toBe("25.0%");
  });

  it("con un .spotlight-host arriba lo sigue a el, aunque el puntero entre por fuera de su padre", () => {
    const { host, spotlight } = renderInHost("spotlight-host");
    fakeBox(host);

    movePointer(host, 250, 125);

    expect(spotlight.style.getPropertyValue("--spotlight-x")).toBe("75.0%");
    expect(spotlight.style.getPropertyValue("--spotlight-y")).toBe("75.0%");
  });

  it("al desmontarse deja de escuchar", () => {
    const { host } = renderInHost("spotlight-host");
    const remove = vi.spyOn(host, "removeEventListener");

    act(() => root.render(h("div")));

    expect(remove).toHaveBeenCalledWith("pointermove", expect.any(Function));
  });
});

describe("estilos del resplandor", () => {
  const patterns = readFileSync("src/styles/patterns.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

  function rule(selector: string) {
    const pattern = selector.replace(/[.:()]/g, "\\$&").replace(/\s+/g, "\\s+");
    return patterns.match(new RegExp(`${pattern}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  }

  it("es un circulo del color del anfitrion en la posicion del puntero, invisible en reposo", () => {
    const capa = rule(".pointer-spotlight");

    expect(capa).toMatch(/position:\s*absolute/);
    expect(capa).toMatch(/inset:\s*0/);
    expect(capa).toMatch(/pointer-events:\s*none/);
    expect(capa).toMatch(/opacity:\s*0/);
    expect(capa).toMatch(
      /radial-gradient\(\s*var\(--spotlight-size\) circle at var\(--spotlight-x\) var\(--spotlight-y\),\s*color-mix\(in oklch, var\(--spotlight-color\) var\(--spotlight-strength\), transparent\),\s*transparent var\(--spotlight-fade\)\s*\)/,
    );
  });

  it("los valores por defecto son los del indicador: 340 px al 13 % hasta el 70 %, desde el centro de arriba", () => {
    const tokens = readFileSync("src/styles/tokens.css", "utf8");

    expect(tokens).toMatch(/^\s*--spotlight-color:\s*var\(--muted-foreground\);/m);
    expect(tokens).toMatch(/^\s*--spotlight-size:\s*340px;/m);
    expect(tokens).toMatch(/^\s*--spotlight-strength:\s*13%;/m);
    expect(tokens).toMatch(/^\s*--spotlight-fade:\s*70%;/m);
    expect(tokens).toMatch(/^\s*--spotlight-x:\s*50%;/m);
    expect(tokens).toMatch(/^\s*--spotlight-y:\s*0%;/m);
  });

  it("aparece con el anfitrion bajo el puntero o con foco de teclado", () => {
    expect(rule(".spotlight-host:hover .pointer-spotlight,\n  .spotlight-host:focus-visible .pointer-spotlight")).toMatch(
      /opacity:\s*1/,
    );
  });

  it("con reducir movimiento aparece sin transicion", () => {
    expect(patterns).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.pointer-spotlight\s*\{\s*transition:\s*none/);
  });
});
