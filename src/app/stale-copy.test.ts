import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// C4 del grupo de fixes (hallazgo 11 de la 11.5): las pantallas prometian lo que «la siguiente
// subfase» iba a traer (el pago de planillas, las reparaciones, la exportacion de los reportes), y
// ya existe. Las subfases son del plan del refactor, no de quien usa el sistema: ningun texto de
// la interfaz las nombra. Se revisa el codigo de `src` que no es de pruebas.

const SRC_DIR = join(process.cwd(), "src");
const IGNORED_DIRS = new Set(["generated", "testing", "__snapshots__"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      return IGNORED_DIRS.has(entry.name) ? [] : sourceFiles(path);
    }

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("C4 del grupo de fixes: textos del plan en la interfaz", () => {
  it("ningun texto habla de una subfase", () => {
    const offending = sourceFiles(SRC_DIR)
      .filter((path) => /subfase/i.test(readFileSync(path, "utf8")))
      .map((path) => relative(process.cwd(), path).replaceAll("\\", "/"));

    expect(offending).toEqual([]);
  });
});
