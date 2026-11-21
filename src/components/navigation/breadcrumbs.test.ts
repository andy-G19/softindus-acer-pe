import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Breadcrumbs } from "@/components/navigation/breadcrumbs";

// Diseno de listados y navegacion (propuesta del responsable, 2026-11-21; D168). Las migas de pan
// son texto de 13 px con 8 px entre partes: el separador es «›» en gris atenuado, los enlaces van
// en gris y al pasar el puntero se aclaran con subrayado (ya no toman el cobre), y la pagina
// actual va en claro y semibold.

const html = renderToStaticMarkup(
  h(Breadcrumbs, {
    items: [
      { label: "Inicio", href: "/dashboard" },
      { label: "Comercial", href: "/dashboard/commercial" },
      { label: "Clientes" },
    ],
  }),
);

function classesOf(pattern: RegExp) {
  return (html.match(pattern)?.[1] ?? "").split(" ");
}

describe("migas de pan", () => {
  it("texto de 13 px con 8 px entre partes", () => {
    expect(classesOf(/<nav [^>]*class="([^"]*)"/)).toContain("text-[13px]");
    expect(classesOf(/<ol class="([^"]*)"/)).toContain("gap-2");
    expect(classesOf(/<li class="([^"]*)"/)).toContain("gap-2");
  });

  it("el separador es «›» en gris atenuado, oculto al lector de pantalla", () => {
    expect(html).not.toContain("<svg");
    expect(html.match(/<span aria-hidden="true" class="([^"]*)">›<\/span>/g)).toHaveLength(2);
    expect(classesOf(/<span aria-hidden="true" class="([^"]*)">›/)).toEqual(
      expect.arrayContaining(["text-muted-foreground/60", "select-none"]),
    );
  });

  it("los enlaces se aclaran con subrayado al pasar el puntero, sin cobre", () => {
    const link = classesOf(/<a [^>]*class="([^"]*)"/);

    expect(link).toEqual(
      expect.arrayContaining([
        "transition-colors",
        "duration-(--motion-fast)",
        "ease-out",
        "underline-offset-2",
        "hover:text-foreground",
        "hover:underline",
      ]),
    );
    expect(link).not.toContain("hover:text-primary");
  });

  it("la pagina actual en claro y semibold", () => {
    expect(classesOf(/<span aria-current="page" class="([^"]*)"/)).toEqual(
      expect.arrayContaining(["text-foreground", "font-semibold"]),
    );
  });
});
