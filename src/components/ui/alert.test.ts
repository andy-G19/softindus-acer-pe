import { readFileSync } from "node:fs";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FormErrorAlert } from "@/components/forms/form-error-alert";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Alertas (propuesta del responsable, 2026-11-19): un color por significado, con su superficie,
// su borde y su texto propios (cierra D101: antes las cinco tenian el mismo borde gris). Icono de
// 20 px, titulo de 14 px en seminegrita y texto de 13 px atenuado.

type Variant = "default" | "info" | "success" | "warning" | "destructive";

function classesOf(html: string, slot: string) {
  // El HTML escribe &, > y ' como entidades dentro del atributo.
  return (new RegExp(`data-slot="${slot}"[^>]*class="([^"]*)"`).exec(html)?.[1] ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&gt;", ">")
    .replaceAll("&#x27;", "'")
    .split(" ");
}

function alertHtml(variant: Variant) {
  return renderToStaticMarkup(
    h(Alert, { variant }, h("svg"), h(AlertTitle, null, "Titulo"), h(AlertDescription, null, "Texto")),
  );
}

describe("Alert", () => {
  const porSignificado = {
    info: "info",
    success: "success",
    warning: "warning",
  } as const;

  for (const [variant, nombre] of Object.entries(porSignificado)) {
    it(`${variant}: superficie, borde, icono y titulo de su significado`, () => {
      expect(classesOf(alertHtml(variant as Variant), "alert")).toEqual(
        expect.arrayContaining([
          `bg-${nombre}-surface`,
          `border-${nombre}-border`,
          `*:[svg]:text-${nombre}-foreground`,
          `*:data-[slot=alert-title]:text-${nombre}-foreground`,
        ]),
      );
    });
  }

  it("destructive: la superficie granate y el borde rojo de los botones, texto rosado", () => {
    expect(classesOf(alertHtml("destructive"), "alert")).toEqual(
      expect.arrayContaining([
        "bg-destructive-surface",
        "border-destructive-border",
        "*:[svg]:text-destructive-foreground",
        "*:data-[slot=alert-title]:text-destructive-foreground",
        "*:data-[slot=alert-description]:text-destructive-foreground/85",
      ]),
    );
  });

  it("default: superficie de acento y el borde comun", () => {
    expect(classesOf(alertHtml("default"), "alert")).toEqual(expect.arrayContaining(["bg-accent", "border-border"]));
  });

  it("medidas: icono de 20 px, relleno de 14 x 16 px, titulo seminegrita de 14 px, texto de 13 px", () => {
    const html = alertHtml("info");

    expect(classesOf(html, "alert")).toEqual(
      expect.arrayContaining(["px-4", "py-3.5", "has-[>svg]:gap-x-3", "*:[svg:not([class*='size-'])]:size-5"]),
    );
    expect(classesOf(html, "alert-title")).toEqual(expect.arrayContaining(["text-sm", "font-semibold"]));
    expect(classesOf(html, "alert-description")).toEqual(
      expect.arrayContaining(["text-[0.8125rem]", "text-muted-foreground"]),
    );
  });

  it("los colores ya no viven en patterns.css", () => {
    const patterns = readFileSync("src/styles/patterns.css", "utf8");

    expect(patterns).not.toMatch(/\.alert-state-/);
    for (const variant of ["default", "info", "success", "warning", "destructive"] as const) {
      expect(classesOf(alertHtml(variant), "alert").filter((name) => name.startsWith("alert-state"))).toEqual([]);
    }
  });
});

describe("FormErrorAlert", () => {
  it("bloque granate con borde, 12 x 16 px de relleno y texto rosado de 13 px en medio peso", () => {
    const html = renderToStaticMarkup(h(FormErrorAlert, { state: { status: "error", error: "Sin permiso." } }));

    expect(classesOf(html, "alert")).toEqual(
      expect.arrayContaining([
        "rounded-md",
        "px-4",
        "py-3",
        "bg-destructive-surface",
        "border-destructive-border",
        "*:data-[slot=alert-description]:text-destructive-foreground",
      ]),
    );
    expect(classesOf(html, "alert-description")).toEqual(expect.arrayContaining(["font-medium"]));
  });
});
