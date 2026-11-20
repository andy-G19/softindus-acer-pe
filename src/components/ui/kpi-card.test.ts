import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Factory } from "lucide-react";

import { KpiCard } from "@/components/ui/kpi-card";

// Diseno de la presentacion (propuesta del responsable, 2026-11-20; D157). El indicador es una
// placa con rejilla de puntos, una franja LED arriba y un halo del color de su tono, y el
// resplandor que sigue el puntero. Ademas admite, opcionales, los datos de la propuesta: periodo,
// minigrafico con su historial, estado, variacion y un dial de segmentos. Hoy solo la galeria
// los llena; cuando lleguen las consultas, las paginas los pasaran. En reposo nada se mueve
// (D153): ni contador, ni pulso de alerta, ni punto que respira.

function render(props: Parameters<typeof KpiCard>[0]) {
  return renderToStaticMarkup(h(KpiCard, props));
}

function slot(html: string, name: string) {
  return html.match(new RegExp(`<[a-z]+ [^>]*data-slot="${name}"[^>]*>`))?.[0];
}

function count(html: string, pattern: RegExp) {
  return html.match(pattern)?.length ?? 0;
}

const base = { title: "Pedidos", value: "12", description: "Pendientes de entrega" } as const;

describe("placa del indicador", () => {
  it("lleva su tono, la franja LED, el halo y el resplandor, todos decorativos", () => {
    const html = render({ ...base, tone: "warning" });
    const card = slot(html, "card") ?? "";

    expect(card).toMatch(/class="[^"]*\bkpi-card\b/);
    expect(card).toMatch(/class="[^"]*\bspotlight-host\b/);
    expect(card).toContain('data-tone="warning"');
    expect(card).toMatch(/style="--kpi-tone:var\(--warning\)"/);
    for (const name of ["kpi-led", "kpi-halo", "pointer-spotlight"]) {
      expect(slot(html, name)).toContain('aria-hidden="true"');
    }
  });

  it("muestra el titulo, el valor y la descripcion, y nada opcional si no se pasa", () => {
    const html = render(base);

    expect(slot(html, "kpi-label")).toBeDefined();
    expect(html).toContain(">Pedidos<");
    expect(html).toMatch(/data-slot="kpi-value"[^>]*>12</);
    expect(html).toContain(">Pendientes de entrega<");
    for (const name of ["kpi-period", "kpi-icon", "kpi-bars", "kpi-footer", "kpi-gauge"]) {
      expect(slot(html, name)).toBeUndefined();
    }
  });

  it("sin enlace no es un enlace ni toma el foco", () => {
    const html = render(base);

    expect(html).not.toContain("<a ");
    expect(html).not.toContain("tabindex");
  });
});

describe("cabecera", () => {
  it("el periodo va en una pildora y el icono en un chip decorativo, a la derecha del titulo", () => {
    const html = render({ ...base, period: "6D", icon: Factory });

    expect(html).toMatch(/data-slot="kpi-period"[^>]*>6D</);
    expect(slot(html, "kpi-icon")).toContain('aria-hidden="true"');
    expect(html.indexOf('data-slot="kpi-label"')).toBeLessThan(html.indexOf('data-slot="kpi-period"'));
    expect(html.indexOf('data-slot="kpi-period"')).toBeLessThan(html.indexOf('data-slot="kpi-icon"'));
  });
});

describe("minigrafico", () => {
  const history = [
    { label: "Día 1", value: 7 },
    { label: "Día 2", value: 9 },
    { label: "Día 3", value: 11, separatorBefore: true },
    { label: "Hoy", value: 12, valueText: "12 pedidos" },
  ];

  it("es una imagen con su texto: cada punto con su etiqueta y su valor", () => {
    const html = render({ ...base, history, historyLabel: "Pedidos de los últimos días" });

    expect(slot(html, "kpi-bars")).toContain('role="img"');
    expect(slot(html, "kpi-bars")).toContain(
      'aria-label="Pedidos de los últimos días: Día 1 7, Día 2 9, Día 3 11, Hoy 12 pedidos"',
    );
  });

  it("dibuja una barra por punto, del 25 % al 100 % entre el minimo y el maximo, con su valor al pasar el puntero", () => {
    const html = render({ ...base, history });
    // La altura va en el estilo de cada barra: una variable leida desde patterns.css tendria que
    // ser un token de tokens.css.
    const heights = [...html.matchAll(/data-slot="kpi-bar"[^>]*style="height:(\d+)%"/g)].map((match) => Number(match[1]));

    expect(heights).toEqual([25, 55, 85, 100]);
    expect(html).toContain('data-tooltip="Día 1: 7"');
    expect(html).toContain('data-tooltip="Hoy: 12 pedidos"');
  });

  it("la ultima barra es la actual y se distingue; el separador va donde se pide", () => {
    const html = render({ ...base, history });

    expect(count(html, /data-current="true"/g)).toBe(1);
    expect(html).toMatch(/data-current="true"[^>]*data-tooltip="Hoy: 12 pedidos"|data-tooltip="Hoy: 12 pedidos"[^>]*data-current="true"/);
    expect(count(html, /data-slot="kpi-bar-separator"/g)).toBe(1);
    expect(html.indexOf('data-slot="kpi-bar-separator"')).toBeLessThan(html.indexOf('data-tooltip="Día 3: 11"'));
  });

  it("valores iguales no dividen entre cero: todas las barras al 100 %", () => {
    const html = render({ ...base, history: [{ label: "A", value: 5 }, { label: "B", value: 5 }] });

    expect([...html.matchAll(/style="height:(\d+)%"/g)].map((match) => match[1])).toEqual(["100", "100"]);
  });
});

describe("pie", () => {
  it("estado con su punto a la izquierda y la variacion a la derecha", () => {
    const html = render({ ...base, status: "Despacho activo", delta: { text: "+2 vs ayer", positive: true } });
    const footer = slot(html, "kpi-footer");

    expect(footer).toBeDefined();
    expect(slot(html, "kpi-status-dot")).toContain('aria-hidden="true"');
    expect(html).toContain(">Despacho activo<");
    expect(html).toMatch(/data-slot="kpi-delta"[^>]*data-positive="true"[^>]*>\+2 vs ayer</);
  });

  it("con enlace toda la placa es el enlace y el pie invita a abrir, sin un enlace dentro de otro", () => {
    const html = render({ ...base, href: "/dashboard/commercial/orders" });

    expect(count(html, /<a /g)).toBe(1);
    const link = html.match(/^<a [^>]*>/)?.[0] ?? "";
    expect(link).toContain('href="/dashboard/commercial/orders"');
    expect(link).toMatch(/class="[^"]*\bspotlight-host\b/);
    // La placa no repite el anfitrion: lo es el enlace, que es lo que toma el foco.
    expect(slot(html, "card")).not.toMatch(/\bspotlight-host\b/);
    expect(html).toMatch(/data-slot="kpi-open"[^>]*>Abrir →</);
  });
});

describe("dial", () => {
  it("dibuja los segmentos con trigonometria y enciende los que corresponden al porcentaje", () => {
    const html = render({ title: "Stock bajo", description: "3 de 8 materiales por debajo del mínimo", tone: "warning", gauge: { current: 3, total: 8 } });

    expect(count(html, /<line /g)).toBe(16);
    expect(count(html, /data-lit="true"/g)).toBe(6);
    expect(html).toMatch(/data-slot="kpi-gauge-value"[^>]*>38<span[^>]*>%<\/span>/);
    expect(slot(html, "kpi-value")).toBeUndefined();
    // El primer segmento empieza a la izquierda (180 grados) y el ultimo termina a la derecha.
    expect(html).toMatch(/<line [^>]*x1="48\.00" y1="104\.00" x2="30\.00" y2="104\.00"/);
    expect(html).toMatch(/<line [^>]*x1="176\.00" y1="104\.00" x2="194\.00" y2="104\.00"/);
  });

  it("admite otra cantidad de segmentos y un total cero sin dividir entre cero", () => {
    expect(count(render({ title: "A", description: "B", gauge: { current: 1, total: 2, segments: 10 } }), /<line /g)).toBe(10);
    expect(render({ title: "A", description: "B", gauge: { current: 0, total: 0 } })).toMatch(/>0<span/);
  });
});

describe("estilos del indicador", () => {
  const patterns = readFileSync("src/styles/patterns.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = readFileSync("src/styles/tokens.css", "utf8");

  function rule(selector: string) {
    const pattern = selector.replace(/[.:()\[\]="]/g, "\\$&").replace(/\s+/g, "\\s+");
    return patterns.match(new RegExp(`(?:^|\\n)\\s*${pattern}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  }

  it("la placa es una rejilla de puntos quieta sobre el fondo de la pagina, sin el cepillado de Card", () => {
    const card = rule(".kpi-card");

    expect(card).toMatch(/background-color:\s*var\(--background\)/);
    expect(card).toMatch(/background-image:\s*radial-gradient\(var\(--kpi-grid-dot\) 1px, transparent 1\.4px\)/);
    expect(card).toMatch(/background-size:\s*16px 16px/);
    expect(card).toMatch(/animation:\s*none/);
    expect(card).toMatch(/--spotlight-color:\s*var\(--kpi-tone\)/);
  });

  it("al pasar el puntero o con foco sube 4 px y el borde y la sombra toman su tono", () => {
    const hover = rule(".kpi-card:hover,\n  .spotlight-host:focus-visible .kpi-card");

    expect(hover).toMatch(/translate:\s*0 -4px/);
    expect(hover).toMatch(/border-color:\s*color-mix\(in oklch, var\(--kpi-tone\) 55%, transparent\)/);
    expect(hover).toMatch(/box-shadow:\s*var\(--shadow-kpi-hover\),\s*0 0 26px 0 color-mix\(in oklch, var\(--kpi-tone\) 18%, transparent\)/);
  });

  it("la franja LED es de 3 px y su destello cruza al pasar el puntero", () => {
    expect(rule(".kpi-led")).toMatch(/height:\s*3px/);
    expect(rule(".kpi-led")).toMatch(/background-color:\s*var\(--kpi-tone\)/);
    expect(rule(".kpi-led::after")).toMatch(/var\(--kpi-led-gleam\)/);
    expect(rule(".kpi-card:hover .kpi-led::after,\n  .spotlight-host:focus-visible .kpi-led::after")).toMatch(/right:\s*72%/);
  });

  it("nada late en reposo y con reducir movimiento no hay transiciones", () => {
    expect(patterns.match(/infinite/g)).toHaveLength(1);
    expect(patterns).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.kpi-card,[^{]*\{\s*transition:\s*none/);
  });

  it("los colores fijos viven en tokens.css", () => {
    expect(tokens).toMatch(/^\s*--kpi-tone:\s*var\(--info\);/m);
    expect(tokens).toMatch(/^\s*--kpi-grid-dot:\s*rgba\(255, 255, 255, 0\.05\);/m);
    expect(tokens).toMatch(/^\s*--kpi-led-gleam:\s*rgba\(255, 255, 255, 0\.95\);/m);
    expect(tokens).toMatch(/^\s*--shadow-kpi-hover:\s*0 18px 38px rgba\(0, 0, 0, 0\.45\);/m);
  });
});
