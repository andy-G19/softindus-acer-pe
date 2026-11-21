import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Package } from "lucide-react";

import { ModuleAccessCard } from "@/components/ui/module-access-card";

// Diseno de la presentacion (propuesta del responsable, 2026-11-20; D158). El acceso a un modulo
// es una placa de acero con su numero de fondo, el icono en un casco del color del modulo, el
// titulo y la descripcion abajo, y una flecha que aparece al pasar el puntero o con foco. Con
// esa intencion la placa sube, el borde toma el acento (cierra D101: antes se veia el borde
// comun), el icono crece, el numero se desplaza y se tine, y el resplandor sigue el puntero. En
// reposo, como en la propuesta, el icono y el numero respiran despacio (D158 eligio la maqueta).

function render(props: Parameters<typeof ModuleAccessCard>[0]) {
  return renderToStaticMarkup(h(ModuleAccessCard, props));
}

function slot(html: string, name: string) {
  return html.match(new RegExp(`<[a-z]+ [^>]*data-slot="${name}"[^>]*>`))?.[0];
}

const base = { title: "Materiales", description: "Catálogo y stock.", href: "/dashboard/inventory/materials" };

describe("placa del modulo", () => {
  it("todo el acceso es un enlace anfitrion del resplandor, con el acento de su tono", () => {
    const html = render({ ...base, tone: "chart-3" });
    const link = html.match(/^<a [^>]*>/)?.[0] ?? "";

    expect(link).toContain('href="/dashboard/inventory/materials"');
    expect(link).toMatch(/class="[^"]*\bspotlight-host\b/);
    expect(slot(html, "card")).toMatch(/class="[^"]*\bmodule-card\b/);
    expect(slot(html, "card")).toContain('style="--module-accent:var(--chart-3)"');
    expect(slot(html, "pointer-spotlight")).toBeDefined();
  });

  it("sin tono usa el primero de los graficos", () => {
    expect(slot(render(base), "card")).toContain('style="--module-accent:var(--chart-1)"');
  });

  it("el numero de fondo va con dos cifras y es decorativo; sin indice no hay numero", () => {
    const html = render({ ...base, index: 3 });

    expect(slot(html, "module-number")).toContain('aria-hidden="true"');
    expect(html).toMatch(/data-slot="module-number"[^>]*>03</);
    expect(slot(render(base), "module-number")).toBeUndefined();
  });

  it("el icono va en un casco decorativo; sin icono, el circulo generico", () => {
    expect(slot(render({ ...base, icon: Package }), "module-icon")).toContain('aria-hidden="true"');
    expect(render({ ...base, icon: Package })).toContain("lucide-package");
    expect(render(base)).toContain("lucide-circle");
  });

  it("titulo, descripcion y la flecha decorativa abajo", () => {
    const html = render(base);

    expect(html).toMatch(/data-slot="module-title"[^>]*>Materiales</);
    expect(html).toMatch(/data-slot="module-description"[^>]*>Catálogo y stock\.</);
    expect(html).toMatch(/data-slot="module-arrow"[^>]*aria-hidden="true"[^>]*>→</);
  });

  it("cada modulo respira desfasado segun su indice, como la propuesta", () => {
    const html = render({ ...base, icon: Package, index: 3 });

    expect(slot(html, "module-number")).toContain("animation-delay:0.8s");
    expect(slot(html, "module-icon")).toContain("animation-delay:1.3s");
  });
});

describe("estilos del modulo", () => {
  const patterns = readFileSync("src/styles/patterns.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = readFileSync("src/styles/tokens.css", "utf8");

  function rule(selector: string) {
    const pattern = selector.replace(/[.:()\[\]="]/g, "\\$&").replace(/\s+/g, "\\s+");
    return patterns.match(new RegExp(`(?:^|\\n)\\s*${pattern}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  }

  it("placa de acero cepillado en degradado, de 176 px como minimo, sin el desplazamiento de Card", () => {
    const card = rule(".module-card");

    expect(card).toMatch(/min-height:\s*176px/);
    expect(card).toMatch(/background-image:\s*var\(--texture-brush\),\s*linear-gradient\(180deg, var\(--card\) 0%, var\(--background\) 100%\)/);
    expect(card).toMatch(/animation:\s*none/);
    expect(card).toMatch(/--spotlight-color:\s*var\(--module-accent\)/);
    expect(card).toMatch(/--spotlight-size:\s*300px/);
  });

  it("con la intencion sube 4 px y el borde toma el acento (D101)", () => {
    const hover = rule(".module-card:hover,\n  .spotlight-host:focus-visible .module-card");

    expect(hover).toMatch(/translate:\s*0 -4px/);
    expect(hover).toMatch(/border-color:\s*var\(--module-accent\)/);
    expect(hover).toMatch(/box-shadow:\s*var\(--shadow-module-hover\),\s*0 0 24px color-mix\(in oklch, var\(--module-accent\) 16%, transparent\)/);
  });

  it("la flecha aparece con la intencion", () => {
    expect(rule(".module-arrow")).toMatch(/opacity:\s*0/);
    expect(rule(".module-card:hover .module-arrow,\n  .spotlight-host:focus-visible .module-arrow")).toMatch(/opacity:\s*1/);
  });

  it("en reposo el numero y el icono respiran despacio, y se detienen con reducir movimiento", () => {
    // La curva se arma por partes: escrita entera en una prueba, Tailwind genera su utilidad en el
    // CSS de produccion.
    const curve = ["ease", "in", "out"].join("-");
    expect(rule(".module-number")).toMatch(new RegExp(`animation:\\s*module-number-breathe 5s ${curve} infinite`));
    expect(rule(".module-icon")).toMatch(new RegExp(`animation:\\s*module-icon-idle 4s ${curve} infinite`));
    expect(patterns).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.module-card,\s*\.module-card \*\s*\{\s*transition:\s*none;\s*animation:\s*none;/,
    );
  });

  it("el acento por defecto y la sombra viven en tokens.css", () => {
    expect(tokens).toMatch(/^\s*--module-accent:\s*var\(--chart-1\);/m);
    expect(tokens).toMatch(/^\s*--shadow-module-hover:\s*0 0 0 1px rgba\(255, 255, 255, 0\.04\), 0 16px 32px rgba\(0, 0, 0, 0\.45\);/m);
  });
});
