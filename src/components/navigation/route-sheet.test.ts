// @vitest-environment jsdom
import { act, createElement as h, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RouteSheet, useRouteSheet } from "@/components/navigation/route-sheet";

// Panel de una ruta interceptada (entrega 9) con el Radix real. Se abre al
// montarse (la navegacion lo monta) y se cierra volviendo atras en el
// historial. Con cambios pendientes, cerrar pide confirmar el descarte; tras
// guardar, cierra sin preguntar y refresca la lista al volver; al cerrar, el
// foco vuelve al enlace que lo abrio (sin disparador, Radix lo mandaria a
// body).

const router = vi.hoisted(() => ({ back: vi.fn(), refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverDouble {
  observe() {}
  unobserve() {}
  disconnect() {}
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverDouble);
  for (const fn of Object.values(router)) {
    fn.mockClear();
  }
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function byText(text: string) {
  const element = [...document.querySelectorAll<HTMLElement>("button, a")].find((item) => item.textContent?.trim() === text);
  if (!element) {
    throw new Error(`No hay "${text}"`);
  }
  return element;
}

const closeX = () => document.querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!;
const confirmation = () => document.querySelector('[role="alertdialog"]');

// Un hijo que usa el contexto del panel, como lo hara ClientForm.
function PanelActions({ busy = false }: { busy?: boolean }) {
  const panel = useRouteSheet();

  useEffect(() => {
    panel?.setBusy(busy);
  }, [panel, busy]);

  return h(
    "div",
    null,
    h("input", { id: "nombre", name: "nombre", defaultValue: "" }),
    h("button", { type: "button", onClick: () => panel?.requestClose() }, "Cancelar formulario"),
    h("button", { type: "button", onClick: () => panel?.closeAfterSave() }, "Simular guardado"),
  );
}

// La lista con el enlace que "abre" el panel: se enfoca y despues se monta el
// panel, como haria la navegacion interceptada.
// La misma estructura en los dos renders: asi el enlace es el mismo elemento.
function page(opener: string, panel: ReturnType<typeof h> | null) {
  return h("div", null, h("a", { href: "/dashboard/commercial/clients/new" }, opener), panel);
}

async function openFrom(opener: string, busy = false) {
  await act(async () => root.render(page(opener, null)));
  byText(opener).focus();
  await act(async () =>
    root.render(
      page(
        opener,
        h(RouteSheet, {
          title: "Nuevo cliente",
          description: "Registra los datos comerciales del cliente.",
          discardTitle: "¿Descartar el cliente nuevo?",
          discardDescription: "Se perderan los datos que escribiste en el panel.",
          children: h(PanelActions, { busy }),
        }),
      ),
    ),
  );
}

describe("RouteSheet", () => {
  it("se abre como panel con su titulo y el foco en el primer campo", async () => {
    await openFrom("Nuevo cliente");

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("Nuevo cliente");
    expect(document.activeElement?.id).toBe("nombre");
  });

  it("sin cambios, cerrar vuelve atras y devuelve el foco al enlace que lo abrio", async () => {
    await openFrom("Nuevo cliente");

    await act(async () => closeX().click());
    await settle();

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(confirmation()).toBeNull();
    expect(document.activeElement).toBe(byText("Nuevo cliente"));
  });

  it("con cambios, cerrar pide confirmar: Cancelar sigue en el panel y Descartar vuelve atras", async () => {
    await openFrom("Nuevo cliente");
    const input = document.querySelector<HTMLInputElement>("#nombre")!;
    input.value = "Andina";
    await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => byText("Cancelar formulario").click());
    expect(confirmation()?.textContent).toContain("¿Descartar el cliente nuevo?");
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => byText("Cancelar").click());
    await settle();
    expect(confirmation()).toBeNull();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => closeX().click());
    await act(async () => byText("Descartar cambios").click());
    await settle();
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("tras guardar cierra sin preguntar aunque haya cambios y refresca la lista al volver", async () => {
    await openFrom("Nuevo cliente");
    const input = document.querySelector<HTMLInputElement>("#nombre")!;
    await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));

    await act(async () => byText("Simular guardado").click());

    expect(confirmation()).toBeNull();
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.refresh).not.toHaveBeenCalled();

    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("mientras el formulario esta ocupado no se cierra", async () => {
    await openFrom("Nuevo cliente", true);

    await act(async () => closeX().click());

    expect(router.back).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("con cambios, recargar o salir de la pagina pide confirmacion al navegador", async () => {
    await openFrom("Nuevo cliente");
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    const input = document.querySelector<HTMLInputElement>("#nombre")!;
    await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);

    expect(dirty.defaultPrevented).toBe(true);
  });

  it("fuera de un panel, useRouteSheet devuelve null", async () => {
    const read = vi.fn();
    function Probe({ onRead }: { onRead: (value: unknown) => void }) {
      onRead(useRouteSheet());
      return null;
    }

    await act(async () => root.render(h(Probe, { onRead: read })));

    expect(read).toHaveBeenCalledWith(null);
  });
});

describe("RouteSheet y su descripcion", () => {
  it("asocia la descripcion al panel", async () => {
    await openFrom("Nuevo cliente");
    const dialog = document.querySelector('[role="dialog"]')!;
    const describedBy = dialog.getAttribute("aria-describedby");

    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("Registra los datos comerciales del cliente.");
  });
});

describe("controles del panel", () => {
  it("son el mismo objeto aunque cambien los cambios pendientes", async () => {
    const seen = new Set<unknown>();
    function Recorder() {
      seen.add(useRouteSheet());
      return h("input", { id: "campo" });
    }

    await act(async () =>
      root.render(
        h(RouteSheet, {
          title: "Nuevo cliente",
          discardTitle: "¿Descartar?",
          discardDescription: "Se perderan los datos.",
          children: h(Recorder),
        }),
      ),
    );
    const input = document.querySelector<HTMLInputElement>("#campo")!;
    await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));

    expect(seen.size).toBe(1);
  });
});
