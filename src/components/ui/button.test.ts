import {
  createElement as h,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

// Contrato del estado pendiente del boton (entrega 8). El HTML completo de
// cada caso esta en primitives.test.ts; aqui se exige cada regla por separado,
// para que un snapshot aceptado sin mirar no pueda esconder su perdida.

function render(node: ReactNode) {
  return renderToStaticMarkup(node);
}

// El spinner es el svg de lucide "loader-circle".
const SPINNER = /<svg[^>]*class="[^"]*lucide-loader-circle[^"]*"[^>]*>/;

describe("Button pendiente", () => {
  // Entrega 9: pendiente es aria-disabled, no disabled. Un boton disabled deja
  // de ser enfocable y Chromium manda el foco a body (K1 de la entrega 8).
  it("queda aria-disabled sin disabled, marca aria-busy y muestra el texto pendiente", () => {
    const html = render(h(Button, { pending: true, pendingText: "Guardando..." }, "Guardar"));

    expect(html).toMatch(/^<button [^>]*aria-disabled="true"/);
    expect(html).not.toMatch(/^<button [^>]*disabled=""/);
    expect(html).toMatch(/^<button [^>]*aria-busy="true"/);
    expect(html).toContain("Guardando...");
    expect(html).not.toContain("Guardar<");
  });

  it("se ve inactivo como un boton deshabilitado y no recibe clics del puntero", () => {
    const classes = render(h(Button, { pending: true }, "Guardar")).match(/^<button [^>]*class="([^"]*)"/)?.[1] ?? "";

    // Clases sueltas: disabled:opacity-50 no cuenta, solo actua con disabled.
    expect(classes.split(" ")).toContain("opacity-50");
    expect(classes.split(" ")).toContain("pointer-events-none");
  });

  it("un disabled={false} del formulario no lo reactiva mientras esta pendiente", () => {
    const html = render(h(Button, { disabled: false, pending: true }, "Guardar"));

    expect(html).toMatch(/^<button [^>]*aria-disabled="true"/);
  });

  it("conserva el contenido si no hay texto pendiente", () => {
    const html = render(h(Button, { pending: true }, "Exportar"));

    expect(html).toContain("Exportar</button>");
  });

  it("muestra un spinner oculto a los lectores que se detiene con reduced motion", () => {
    const spinner = render(h(Button, { pending: true }, "Guardar")).match(SPINNER)?.[0] ?? "";

    expect(spinner).toContain('aria-hidden="true"');
    expect(spinner).toContain("animate-spin");
    expect(spinner).toContain("motion-reduce:animate-none");
    expect(spinner).toContain('data-icon="inline-start"');
  });

  it("en solo icono reemplaza el icono y mantiene el aria-label", () => {
    const html = render(h(Button, { size: "icon", pending: true, "aria-label": "Eliminar" }, h(Plus)));

    expect(html).toMatch(SPINNER);
    expect(html).not.toContain("lucide-plus");
    expect(html).toContain('aria-label="Eliminar"');
  });

  it("sin pending no agrega atributos ni spinner", () => {
    for (const pending of [undefined, false]) {
      const html = render(h(Button, { type: "submit", pending, pendingText: "Guardando..." }, "Guardar"));

      expect(html).toBe(render(h(Button, { type: "submit" }, "Guardar")));
      expect(html).not.toContain("aria-busy");
      expect(html).not.toMatch(SPINNER);
    }
  });

  it("como enlace (asChild) ignora pending", () => {
    const link = h("a", { href: "/dashboard" }, "Volver");
    // Los tipos lo impiden; aqui se fuerza para fijar lo que pasa en ejecucion.
    const props = { asChild: true, pending: true } as unknown as ComponentProps<typeof Button>;

    expect(render(h(Button, props, link))).toBe(render(h(Button, { asChild: true }, link)));
  });
});

// Verificacion del piloto en staging (entrega 9): la galeria pinta
// <Button pending> desde un componente de servidor, y React Server Components
// no admite funciones en un elemento que llega del servidor (la pagina daba
// 500). renderToStaticMarkup ignora los manejadores, asi que aqui se miran las
// props del elemento que devuelve Button.
function element(props: ComponentProps<typeof Button>) {
  return Button(props) as ReactElement<ComponentProps<"button">>;
}

function click() {
  const preventDefault = vi.fn();

  return { event: { preventDefault } as unknown as MouseEvent<HTMLButtonElement>, preventDefault };
}

describe("guarda de clic del boton pendiente", () => {
  it("de tipo button y sin onClick no lleva manejadores: un componente de servidor puede pintarlo", () => {
    expect(element({ type: "button", pending: true, children: "Guardar" }).props.onClick).toBeUndefined();
  });

  it("de envio, tambien sin type, cancela el clic (y con el, el envio)", () => {
    for (const type of ["submit", undefined] as const) {
      const { onClick } = element({ type, pending: true, children: "Guardar" }).props;
      const { event, preventDefault } = click();

      expect(onClick).toBeTypeOf("function");
      onClick?.(event);
      expect(preventDefault).toHaveBeenCalledOnce();
    }
  });

  it("con un onClick propio no lo llama mientras esta pendiente", () => {
    const own = vi.fn();
    const { onClick } = element({ type: "button", pending: true, onClick: own, children: "Guardar" }).props;
    const { event, preventDefault } = click();

    onClick?.(event);
    expect(own).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});

describe("tipos del boton", () => {
  // Comprobacion de tipos: la verifica typecheck, no la ejecucion.
  function props(value: ComponentProps<typeof Button>) {
    return value;
  }

  it("los tamanos de solo icono exigen aria-label", () => {
    // @ts-expect-error: un boton de solo icono necesita un nombre accesible
    props({ size: "icon" });
    // @ts-expect-error: tambien en los tamanos icon-xs, icon-sm e icon-lg
    props({ size: "icon-xs" });

    expect(props({ size: "icon", "aria-label": "Agregar" })).toBeTruthy();
    expect(props({ size: "sm" })).toBeTruthy();
  });

  it("un enlace (asChild) no admite estado pendiente", () => {
    // @ts-expect-error: un enlace no se envia ni se deshabilita
    props({ asChild: true, pending: true });
    // @ts-expect-error: ni texto pendiente
    props({ asChild: true, pendingText: "Cargando..." });

    expect(props({ asChild: true })).toBeTruthy();
  });
});
