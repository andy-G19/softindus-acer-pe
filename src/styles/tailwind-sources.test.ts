import { readFileSync } from "node:fs";
import path from "node:path";

import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { beforeAll, describe, expect, it } from "vitest";

// Archivos que Tailwind lee para generar utilidades (entrega 10). Tailwind v4
// convierte en CSS cada palabra con forma de clase que encuentra en los
// archivos que git no ignora, tambien en los .md: la documentacion de las
// entregas 8 y 9 metio en el CSS de produccion cuatro utilidades de color y de
// ancho que ninguna pantalla usa. Por eso este comentario no nombra ninguna
// clase. La prueba reproduce lo que hace @tailwindcss/postcss en el build:
// compila src/app/globals.css (con sus @import y @source) y recorre los
// archivos con el mismo Scanner, desde la raiz del proyecto.

const ROOT = process.cwd();
const GLOBALS = path.join(ROOT, "src/app/globals.css");

let files: string[] = [];

function relative(file: string) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

beforeAll(async () => {
  const compiler = await compile(readFileSync(GLOBALS, "utf8"), {
    base: path.dirname(GLOBALS),
    onDependency: () => {},
  });

  const root =
    compiler.root === "none"
      ? []
      : compiler.root === null
        ? [{ base: ROOT, pattern: "**/*", negated: false }]
        : [{ ...compiler.root, negated: false }];

  const scanner = new Scanner({ sources: [...root, ...compiler.sources] });
  scanner.scan();
  files = scanner.files.map(relative);
}, 60_000);

describe("fuentes de Tailwind", () => {
  it("lee el codigo de la interfaz", () => {
    expect(files).toContain("src/components/ui/button.tsx");
    expect(files).toContain("src/app/(dashboard)/dashboard/commercial/clients/page.tsx");
  });

  it("no lee ningun archivo Markdown", () => {
    expect(files.filter((file) => file.endsWith(".md"))).toEqual([]);
  });
});
