import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";

// Diseno de la presentacion (propuesta del responsable, 2026-11-20; D153 y D154). La etiqueta es
// un rectangulo de 24 px, radio de 6 px, letra sans de 11 px en negrita y mayusculas, con el
// color de cada variante tomado de un token. En reposo no se mueve (D153): success se asienta con
// un sello al montar y destructive sacude una vez; ninguna variante tiene un bucle.
// Revision en staging (D161 y D162): el lingote cobre con resplandor de default y el hover que
// subia 3 px y crecia al 105 % la hacian parecer un boton, y no se puede pulsar. Default es ahora
// una placa de acero con texto cobre y una franja cobre a la izquierda, y al pasar el puntero
// todas solo se aclaran.

type Variant = NonNullable<Parameters<typeof Badge>[0]["variant"]>;

function classes(variant?: Variant) {
  return (renderToStaticMarkup(h(Badge, { variant }, "Etiqueta")).match(/^<span [^>]*class="([^"]*)"/)?.[1] ?? "").split(
    " ",
  );
}

function withoutComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const VARIANTS = [
  "default",
  "success",
  "warning",
  "info",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
] as const satisfies readonly Variant[];

describe("forma de la etiqueta", () => {
  it("rectangulo de 24 px, radio de 6 px y 10 px de relleno", () => {
    const actual = classes();

    for (const name of ["h-6", "rounded-sm", "px-2.5", "border"]) {
      expect(actual).toContain(name);
    }
    expect(actual).not.toContain("h-5");
    expect(actual).not.toContain("rounded-4xl");
  });

  it("letra sans de 11 px en negrita, mayusculas y espaciado de 0,03em", () => {
    const actual = classes();

    for (const name of ["font-sans", "text-[11px]", "font-bold", "uppercase", "tracking-[0.03em]"]) {
      expect(actual).toContain(name);
    }
    expect(actual).not.toContain("font-mono");
  });
});

describe("colores de las variantes", () => {
  const expected: Record<Variant, string[]> = {
    default: ["border-border", "bg-secondary", "text-primary", "shadow-badge-default"],
    secondary: ["bg-muted", "bg-(image:--texture-brush)", "text-foreground", "shadow-badge-secondary"],
    success: ["border-success-border", "bg-success-surface", "text-success-foreground"],
    warning: ["border-warning-border", "bg-warning-surface", "text-warning-foreground"],
    info: ["border-info-border", "bg-info-surface", "text-info-foreground"],
    destructive: ["border-destructive-border", "bg-destructive-surface", "text-destructive-foreground"],
    outline: ["border-control-border", "bg-transparent", "text-foreground", "hover:border-control-border-hover"],
    ghost: ["bg-transparent", "text-muted-foreground", "hover:bg-ghost-hover", "hover:text-foreground"],
    link: ["bg-transparent", "px-[3px]", "text-primary", "hover:text-primary-hover", "bg-(image:--badge-filament)"],
  };

  for (const variant of VARIANTS) {
    it(`${variant} usa los tokens de la propuesta`, () => {
      const actual = classes(variant);

      expect(expected[variant].filter((name) => !actual.includes(name))).toEqual([]);
    });
  }

  // Un boton primario es un relleno cobre con resplandor: default no rellena con cobre ni brilla.
  it("default no se parece a un boton: sin relleno cobre ni degradado", () => {
    const actual = classes("default");

    expect(actual.filter((name) => /^bg-(primary|\(image:)/.test(name))).toEqual([]);
    expect(actual).not.toContain("text-primary-foreground");
  });

  it("la franja de default es una sombra interior cobre de 2 px a la izquierda, sin resplandor", () => {
    const tokens = withoutComments(readFileSync("src/styles/tokens.css", "utf8"));

    expect(tokens).toMatch(/^\s*--shadow-badge-default:\s*inset 2px 0 0 var\(--primary\);/m);
  });

  // Hasta este diseno secondary pintaba la misma clase que info y no se distinguian.
  it("secondary ya no se ve igual que info", () => {
    expect(classes("secondary")).not.toContain("bg-info-surface");
  });

  it("ninguna variante usa las clases badge-state ni variantes dark: de color", () => {
    for (const variant of VARIANTS) {
      const actual = classes(variant);

      expect(actual.filter((name) => name.includes("badge-state"))).toEqual([]);
      expect(actual.filter((name) => name.startsWith("dark:") && !name.startsWith("dark:aria-invalid:"))).toEqual([]);
    }
  });

  it("las clases de tono por estado ya no viven en patterns.css", () => {
    expect(withoutComments(readFileSync("src/styles/patterns.css", "utf8"))).not.toMatch(/\.badge-state-/);
  });
});

describe("movimiento de la etiqueta", () => {
  // En Tailwind v4 el filtro es una propiedad CSS propia: la transicion la nombra. Con reducir
  // movimiento no hay transicion.
  it("al pasar el puntero cada variante solo se aclara: no sube ni crece", () => {
    const tacto = [
      "transition-[color,background-color,border-color,box-shadow,filter]",
      "duration-(--motion-base)",
      "hover:brightness-110",
      "motion-reduce:transition-none",
    ];

    for (const variant of VARIANTS) {
      const actual = classes(variant);

      expect(tacto.filter((name) => !actual.includes(name))).toEqual([]);
      expect(actual.filter((name) => /translate|scale/.test(name))).toEqual([]);
      expect(actual).not.toContain("transition-all");
    }
  });

  it("success se asienta con un sello y destructive sacude, una sola vez", () => {
    expect(classes("success")).toContain("badge-settle");
    expect(classes("destructive")).toContain("badge-shake");

    for (const variant of VARIANTS.filter((name) => name !== "success" && name !== "destructive")) {
      expect(classes(variant).filter((name) => name.startsWith("badge-"))).toEqual([]);
    }
  });

  // StateBadge elige el gesto de cada estado (D155): entregado solo se asienta, anulado entra con
  // un golpe de sello y registrado se sella aunque sea info.
  it("gesture reemplaza el gesto de la variante, y none lo quita", () => {
    function gestures(variant: Variant, gesture: "settle" | "pop" | "shake" | "stamp" | "none") {
      return (
        renderToStaticMarkup(h(Badge, { variant, gesture }, "Etiqueta")).match(/^<span [^>]*class="([^"]*)"/)?.[1] ?? ""
      )
        .split(" ")
        .filter((name) => ["badge-settle", "badge-pop", "badge-shake", "badge-stamp"].includes(name));
    }

    expect(gestures("info", "settle")).toEqual(["badge-settle"]);
    expect(gestures("success", "pop")).toEqual(["badge-pop"]);
    expect(gestures("destructive", "stamp")).toEqual(["badge-stamp"]);
    expect(gestures("success", "none")).toEqual([]);
  });

  it("los gestos no se repiten y se apagan con reducir movimiento", () => {
    const patterns = withoutComments(readFileSync("src/styles/patterns.css", "utf8"));
    const settle = patterns.match(/\.badge-settle\s*\{([^}]*)\}/)?.[1] ?? "";
    const shake = patterns.match(/\.badge-shake\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(settle).toMatch(/animation:\s*badge-pop\b/);
    expect(shake).toMatch(/animation:\s*badge-shake\b/);
    expect(`${settle}${shake}`).not.toContain("infinite");
    expect(patterns).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.badge-settle,\s*\.badge-shake[^{]*\{\s*animation:\s*none;/,
    );
  });
});

describe("tokens de la etiqueta", () => {
  const tokens = withoutComments(readFileSync("src/styles/tokens.css", "utf8"));

  it("los colores, sombras y texturas de la etiqueta existen en :root y en @theme", () => {
    for (const name of ["--badge-filament", "--texture-brush"]) {
      expect(tokens).toMatch(new RegExp(`^\\s*${name}:`, "m"));
    }
    for (const name of ["--shadow-badge-default", "--shadow-badge-secondary"]) {
      expect(tokens).toMatch(new RegExp(`^\\s*${name}:\\s*var\\(`, "m"));
    }
    expect(tokens).toMatch(/--ease-spring:\s*cubic-bezier\(0\.34, 1\.56, 0\.64, 1\)/);
  });

  it("el degradado y el borde del lingote, que ya no tienen uso, no existen", () => {
    expect(tokens).not.toContain("--badge-default-surface");
    expect(tokens).not.toContain("--badge-default-border");
  });
});
