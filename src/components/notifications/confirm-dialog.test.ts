import { createElement as h, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/notifications/confirm-dialog";
import { Button } from "@/components/ui/button";

// Confirmacion accesible (entrega 8). Radix no renderiza los portales en el
// servidor: el doble los vuelve un paso directo y, mientras radixDouble.open
// es true, abre la ventana. Asi se fija en Node lo que el lector de pantalla
// recibe (alertdialog, titulo y descripcion asociados, orden de botones,
// pendiente). El foco inicial en Cancelar, Esc, la devolucion del foco y el
// pendiente tras un clic real se prueban a mano en la galeria.

const radixDouble = vi.hoisted(() => ({ open: true }));

vi.mock("radix-ui", async (importOriginal) => {
  const radix = await importOriginal<typeof import("radix-ui")>();
  const { createElement, Fragment } = await import("react");

  return {
    ...radix,
    AlertDialog: {
      ...radix.AlertDialog,
      Root: (props: ComponentProps<typeof radix.AlertDialog.Root>) =>
        createElement(radix.AlertDialog.Root, radixDouble.open ? { ...props, open: true } : props),
      Portal: ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children),
    },
  };
});

afterEach(() => {
  radixDouble.open = true;
});

// La variante con disparador: Partial sobre la union mezclaria los dos modos.
type Props = Extract<ComponentProps<typeof ConfirmDialog>, { trigger: ReactElement }>;

const base: Props = {
  trigger: h(Button, { type: "button", variant: "secondary" }, "Cerrar orden"),
  title: "¿Cerrar la orden de trabajo OTR00000099?",
  description: "La orden pasara a cerrada y ya no admitira avances.",
  confirmText: "Cerrar orden",
  onConfirm: () => {},
};

function render(props: Partial<Props> = {}) {
  return renderToStaticMarkup(h(ConfirmDialog, { ...base, ...props }));
}

function tag(html: string, pattern: RegExp) {
  return html.match(pattern)?.[0] ?? "";
}

// Una etiqueta por linea, como en primitives.test.ts.
const markup = (props: Partial<Props> = {}) => render(props).replace(/></g, ">\n<");

describe("ConfirmDialog", () => {
  it("cerrada solo muestra el disparador", () => {
    radixDouble.open = false;
    const html = render();

    expect(html).toMatch(/^<button [^>]*aria-haspopup="dialog" aria-expanded="false"/);
    expect(html).not.toContain("alertdialog");
  });

  it("es un alertdialog con el titulo y la consecuencia asociados", () => {
    const html = render();
    const dialog = tag(html, /<div role="alertdialog"[^>]*>/);
    const labelledBy = dialog.match(/aria-labelledby="([^"]+)"/)?.[1];
    const describedBy = dialog.match(/aria-describedby="([^"]+)"/)?.[1];

    expect(tag(html, new RegExp(`<h2 id="${labelledBy}"[^>]*>[^<]*`))).toContain(base.title);
    expect(tag(html, new RegExp(`<p id="${describedBy}"[^>]*>[^<]*`))).toContain("ya no admitira avances");
  });

  it("pone Cancelar antes de la accion, que lleva el verbo concreto", () => {
    const html = render();

    expect(html.indexOf(">Cancelar</button>")).toBeGreaterThan(-1);
    expect(html.indexOf(">Cancelar</button>")).toBeLessThan(html.indexOf(">Cerrar orden</button>", html.indexOf("alertdialog")));
  });

  it("el icono es decorativo y la variante decide sus colores y los de la accion", () => {
    const normal = render();
    const destructive = render({ variant: "destructive", confirmText: "Anular pedido" });

    expect(tag(normal, /<svg[^>]*lucide-triangle-alert[^>]*>/)).toContain('aria-hidden="true"');
    expect(normal).toContain("bg-warning/10 text-warning");
    expect(destructive).toContain("bg-destructive/10 text-destructive");
    expect(tag(destructive, /<button [^>]*>Anular pedido/)).toContain('data-variant="destructive"');
  });

  it("pendiente: la accion espera y Cancelar se bloquea", () => {
    const html = render({ pending: true, pendingText: "Cerrando..." });
    const action = tag(html, /<button [^>]*aria-busy="true"[^>]*>/);

    // La accion conserva el foco mientras espera (aria-disabled, entrega 9);
    // Cancelar se deshabilita de verdad.
    expect(action).toContain('aria-disabled="true"');
    expect(action).not.toContain('disabled=""');
    expect(html).toContain("Cerrando...</button>");
    expect(tag(html, /<button [^>]*>Cancelar/)).toContain('disabled=""');
  });

  it("el velo y la ventana usan los tokens y detienen la animacion con reduced motion", () => {
    const html = render();
    const overlay = tag(html, /<div [^>]*data-slot="alert-dialog-overlay"[^>]*>/);
    const content = tag(html, /<div role="alertdialog"[^>]*>/);

    expect(overlay).toContain("bg-overlay");
    expect(content).toContain("shadow-dialog");
    for (const element of [overlay, content]) {
      expect(element).toContain("motion-reduce:animate-none!");
    }
  });

  it.each([
    ["normal", {}],
    ["destructiva", { variant: "destructive" as const, title: "¿Anular el pedido PED00000099?", confirmText: "Anular pedido" }],
    ["pendiente", { pending: true, pendingText: "Cerrando..." }],
  ])("HTML de la ventana abierta: %s", (_name, props) => {
    expect(markup(props)).toMatchSnapshot();
  });

  it("los tipos exigen la entidad, la consecuencia y el verbo", () => {
    // Comprobacion de tipos: la verifica typecheck, no la ejecucion.
    const { title, description, confirmText, ...rest } = base;

    // @ts-expect-error: sin verbo concreto no hay confirmacion
    expect(() => h(ConfirmDialog, { ...rest, title, description })).not.toThrow();
    // @ts-expect-error: sin consecuencia tampoco
    expect(() => h(ConfirmDialog, { ...rest, title, confirmText })).not.toThrow();
    // @ts-expect-error: ni sin la pregunta con la entidad
    expect(() => h(ConfirmDialog, { ...rest, description, confirmText })).not.toThrow();
  });
});

// Modo controlado (entrega 9): sin disparador; la abre quien la usa, por
// ejemplo al intentar cerrar un formulario con cambios.
describe("ConfirmDialog controlada", () => {
  const withoutTrigger = { ...base, trigger: undefined };

  function renderControlled(open: boolean) {
    radixDouble.open = false;
    return renderToStaticMarkup(h(ConfirmDialog, { ...withoutTrigger, open, onOpenChange: () => {} }));
  }

  it("cerrada no pinta nada: no tiene disparador", () => {
    expect(renderControlled(false)).toBe("");
  });

  it("abierta pinta la confirmacion sin disparador", () => {
    const html = renderControlled(true);

    expect(html).toContain('role="alertdialog"');
    expect(html).not.toContain('aria-haspopup="dialog"');
    expect(html.indexOf(">Cancelar</button>")).toBeLessThan(html.indexOf(">Cerrar orden</button>"));
  });

  it("los tipos exigen disparador u open con onOpenChange, nunca los dos", () => {
    // Comprobacion de tipos: la verifica typecheck, no la ejecucion.
    // @ts-expect-error: o disparador o open, no los dos
    expect(() => h(ConfirmDialog, { ...base, open: true, onOpenChange: () => {} })).not.toThrow();
    // @ts-expect-error: open sin onOpenChange no se puede cerrar
    expect(() => h(ConfirmDialog, { ...withoutTrigger, open: true })).not.toThrow();
    // @ts-expect-error: sin disparador ni open nadie la abre
    expect(() => h(ConfirmDialog, withoutTrigger)).not.toThrow();
  });

  // Entrega 10: ConfirmActionButton la deja abierta al confirmar y muestra
  // dentro el error de la accion.
  it("con error muestra el mensaje en una alerta, despues de la consecuencia y antes de los botones", () => {
    radixDouble.open = false;
    const html = renderToStaticMarkup(
      h(ConfirmDialog, {
        ...withoutTrigger,
        open: true,
        onOpenChange: () => {},
        closeOnConfirm: false,
        error: "La categoría ya estaba inactiva.",
      }),
    );
    const alert = html.indexOf('role="alert"');

    expect(alert).toBeGreaterThan(html.indexOf("ya no admitira avances"));
    expect(alert).toBeLessThan(html.indexOf(">Cancelar</button>"));
    expect(html).toContain("La categoría ya estaba inactiva.");
    expect(renderControlled(true)).not.toContain('role="alert"');
  });

  it("closeOnConfirm solo existe en el modo controlado", () => {
    // Comprobacion de tipos: con disparador nadie podria cerrarla desde fuera.
    // @ts-expect-error: closeOnConfirm exige open y onOpenChange
    expect(() => h(ConfirmDialog, { ...base, closeOnConfirm: false })).not.toThrow();
  });
});
