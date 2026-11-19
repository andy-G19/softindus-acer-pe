import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// C6 del grupo de fixes (D128, hallazgo 36 de la 10.7a): un formulario GET carga el documento, y al
// volver con Atras el navegador restauraba en los campos lo que se habia escrito, aunque la lista ya
// no lo aplicara (la URL sin filtros y la barra con «zzz»). Ninguna `key` lo evita: es el
// navegador, no React. Con `autoComplete="off"` en el <form>, que heredan sus campos, el navegador
// no los restaura. Medido en staging antes de escribir el arreglo (lista de clientes: antes, la
// barra con «zzz» e «Inactivo» tras Atras; con el atributo puesto a mano, vacia).
//
// jsdom no tiene historial ni restaura formularios: esta prueba solo puede fijar el atributo, en
// todo formulario GET de `src` (FilterBar y los dos de Caja chica que todavia no la usan). La
// demostracion del dialogo de la galeria usa `method="get"` sin navegar y queda fuera.

const SRC_DIR = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "generated" ? [] : sourceFiles(path);
    }

    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path] : [];
  });
}

describe("C6 del grupo de fixes: los formularios GET no restauran lo escrito", () => {
  it("todo <form method=\"GET\"> lleva autoComplete=\"off\"", () => {
    const forms = sourceFiles(SRC_DIR).flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(/<form\b[^>]*?method="GET"[^>]*>/g)].map((match) => ({
        file: relative(process.cwd(), path).replaceAll("\\", "/"),
        tag: match[0].replace(/\s+/g, " "),
      })),
    );

    expect(forms.length, "FilterBar y los dos formularios de Caja chica").toBeGreaterThanOrEqual(3);
    expect(forms.filter((form) => !form.tag.includes('autoComplete="off"'))).toEqual([]);
  });
});
