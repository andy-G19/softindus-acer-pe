import {
  createElement as h,
  type ComponentProps,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { readFileSync } from "node:fs";
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

// Diseno de los botones (propuesta del responsable, 2026-11-19): cada variante toma sus
// colores de los tokens de tokens.css, no de mezclas sueltas. El HTML completo esta en
// primitives.test.ts; aqui se exige, por variante, la clase de cada estado que pide la
// propuesta, para que un snapshot aceptado sin mirar no pueda esconder su perdida.
function variantClasses(variant: NonNullable<ComponentProps<typeof Button>["variant"]>) {
  return (render(h(Button, { variant }, "Guardar")).match(/^<button [^>]*class="([^"]*)"/)?.[1] ?? "").split(" ");
}

describe("colores de las variantes", () => {
  const expected = {
    default: [
      "bg-primary",
      "bg-linear-to-b",
      "from-primary-hover",
      "to-primary",
      "shadow-button",
      "text-primary-foreground",
      "hover:bg-none",
      "hover:bg-primary-hover",
      "active:bg-none",
      "active:bg-primary-active",
      "active:shadow-none",
    ],
    secondary: ["bg-accent", "border-border", "text-foreground", "hover:bg-secondary-hover", "aria-expanded:bg-secondary-hover"],
    outline: [
      "bg-transparent",
      "border-control-border",
      "text-foreground",
      "hover:bg-muted",
      "hover:border-control-border-hover",
      "aria-expanded:bg-muted",
      "aria-expanded:border-control-border-hover",
    ],
    ghost: ["bg-transparent", "text-foreground", "hover:bg-ghost-hover", "aria-expanded:bg-ghost-hover"],
    destructive: [
      "bg-destructive-surface",
      "border-destructive-border",
      "text-destructive-foreground",
      "hover:bg-destructive-surface-hover",
      "hover:border-destructive-outline",
    ],
    link: ["text-primary", "underline", "decoration-link-underline", "underline-offset-4", "hover:decoration-primary"],
    clear: ["bg-clear-surface", "border-clear-border", "text-clear-foreground", "hover:bg-clear-surface-hover"],
  } as const;

  for (const [variant, classes] of Object.entries(expected)) {
    it(`${variant} usa los tokens de la propuesta`, () => {
      const actual = variantClasses(variant as keyof typeof expected);

      expect(classes.filter((name) => !actual.includes(name))).toEqual([]);
    });
  }

  it("ninguna variante usa el cian, el degradado de brand.css ni variantes dark:", () => {
    for (const variant of Object.keys(expected)) {
      const actual = variantClasses(variant as keyof typeof expected);

      expect(actual.filter((name) => name.includes("cyan"))).toEqual([]);
      expect(actual).not.toContain("forge-button-gradient");
      // La app es solo oscura y .dark esta en <html>: un dark: siempre gana a la clase base, asi
      // que la variante se definiria dos veces. Los de aria-invalid son de la base comun y quedan.
      expect(actual.filter((name) => name.startsWith("dark:") && !name.startsWith("dark:aria-invalid:"))).toEqual([]);
    }
  });
});

// Foco de teclado del boton (propuesta del responsable, 2026-11-19): 2px del color de fondo y
// 2px de anillo solido, naranja o rojo en destructive, para que se vea tambien sobre el boton
// naranja. Las utilidades de anillo con separacion de Tailwind dibujan exactamente eso y se
// suman a la sombra del boton en el mismo box-shadow. La regla global de patterns.css (contorno naranja en enlaces, botones y
// campos) gana a las clases de Button (0-2-0 contra 0-1-0), asi que excluye los botones: si no,
// se verian el contorno y el anillo a la vez.
describe("foco del boton", () => {
  // El nombre no es el de una utilidad: Tailwind genera una clase por cada palabra que lo parezca.
  const anilloConHueco = [
    "focus-visible:ring-2",
    "focus-visible:ring-offset-2",
    "focus-visible:ring-offset-background",
  ];

  it("cada variante dibuja el anillo con hueco del color de fondo", () => {
    for (const variant of ["default", "secondary", "outline", "ghost", "destructive", "link", "clear"] as const) {
      const actual = variantClasses(variant);

      expect(anilloConHueco.filter((name) => !actual.includes(name))).toEqual([]);
      expect(actual).not.toContain("focus-visible:ring-3");
      expect(actual.filter((name) => name.startsWith("focus-visible:border-"))).toEqual([]);
    }
  });

  it("el anillo es naranja, y rojo en destructive", () => {
    expect(variantClasses("default")).toContain("focus-visible:ring-ring");
    expect(variantClasses("destructive")).toContain("focus-visible:ring-destructive-outline");
    expect(variantClasses("destructive")).not.toContain("focus-visible:ring-ring");
  });

  it("la regla global del contorno de foco no alcanza a los botones", () => {
    const patterns = readFileSync("src/styles/patterns.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selector = /([^{}]*):focus-visible\s*\{\s*outline:\s*2px solid/.exec(patterns)?.[1].trim() ?? "";

    expect(selector).toContain(":where(a, button,");
    expect(selector).toContain(':not([data-slot="button"])');
  });

  // Un :not() suma la especificidad de su argumento: con la exclusion suelta, la regla pasaba de
  // 0-2-0 a 0-3-0 y ganaba al outline: none de los campos enfocados (0-2-1), que mostraban el
  // contorno y su sombra a la vez (visto en staging). Dentro de :where() no suma nada.
  it("la exclusion de los botones no sube la especificidad de la regla", () => {
    const patterns = readFileSync("src/styles/patterns.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selector = /([^{}]*):focus-visible\s*\{\s*outline:\s*2px solid/.exec(patterns)?.[1].trim() ?? "";

    expect(selector).toContain(':where(:not([data-slot="button"]))');
  });
});

// Animacion de tacto (propuesta del responsable mas la opcion Tacto, 2026-11-19): transiciones
// de 150 ms (--motion-fast) en las propiedades que cambian, el boton sube 1px al pasar el
// puntero y al pulsarlo baja 1px y se encoge al 97 %. En Tailwind v4 el desplazamiento y la
// escala son propiedades CSS propias, no la de transformacion: la transicion las nombra.
// Con prefers-reduced-motion no hay transicion ni movimiento; el important gana a las clases
// de hover y active, que tienen mas especificidad que la de la media query.
describe("animacion del boton", () => {
  const tacto = [
    "transition-[color,background-color,border-color,text-decoration-color,box-shadow,translate,scale,opacity]",
    "duration-(--motion-fast)",
    "ease-out",
    "hover:-translate-y-px",
    "active:not-aria-[haspopup]:translate-y-px",
    "active:not-aria-[haspopup]:scale-97",
    "motion-reduce:transition-none",
    "motion-reduce:translate-none!",
    "motion-reduce:scale-none!",
  ];

  it("cada variante salvo link sube al pasar el puntero y se hunde al pulsar", () => {
    for (const variant of ["default", "secondary", "outline", "ghost", "destructive", "clear"] as const) {
      const actual = variantClasses(variant);

      expect(tacto.filter((name) => !actual.includes(name))).toEqual([]);
      expect(actual).not.toContain("transition-all");
    }
  });

  it("link no se mueve: es texto subrayado, no un bloque", () => {
    const actual = variantClasses("link");

    expect(actual).toContain("hover:translate-y-0");
    expect(actual).toContain("active:not-aria-[haspopup]:translate-y-0");
    expect(actual).toContain("active:not-aria-[haspopup]:scale-100");
    expect(actual).not.toContain("hover:-translate-y-px");
    expect(actual).toContain("motion-reduce:transition-none");
  });

  it("el spinner gira con la duracion del token", () => {
    const spinner = render(h(Button, { pending: true }, "Guardar")).match(SPINNER)?.[0] ?? "";

    expect(spinner).toContain("[animation-duration:var(--motion-spin)]");
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
