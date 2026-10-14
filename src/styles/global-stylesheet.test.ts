import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Estructura de la hoja global (entrega 8). src/app/globals.css solo importa:
// el orden de las importaciones es el orden de las reglas en el CSS compilado
// y decide su prioridad cuando dos reglas de igual especificidad compiten. Al
// separarla se comprobo que el CSS compilado era identico byte a byte; esta
// prueba impide que una regla vuelva a la hoja global, que se reordene una
// importacion sin revisarlo o que un archivo de src/styles quede sin importar.

const GLOBALS = "src/app/globals.css";
const STYLES_DIR = "src/styles";

const EXPECTED_IMPORTS = [
  "tailwindcss",
  "tw-animate-css",
  "shadcn/tailwind.css",
  "../styles/tokens.css",
  "../styles/base.css",
  "../styles/brand.css",
  "../styles/adapters/toastify.css",
  "../styles/adapters/sweetalert2.css",
  "../styles/patterns.css",
  "../styles/adapters/legacy-industrial-dark.css",
];

function withoutComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return cssFiles(fullPath);
    }

    return entry.name.endsWith(".css") ? [fullPath.split(path.sep).join("/")] : [];
  });
}

describe("hoja global", () => {
  const statements = withoutComments(readFileSync(GLOBALS, "utf8"))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  it("solo contiene importaciones", () => {
    for (const statement of statements) {
      expect(statement).toMatch(/^@import "[^"]+";$/);
    }
  });

  it("importa en el orden que fija la prioridad de las reglas", () => {
    expect(statements.map((statement) => statement.slice(9, -2))).toEqual(EXPECTED_IMPORTS);
  });

  it("importa cada archivo de src/styles una sola vez", () => {
    const imported = EXPECTED_IMPORTS.filter((item) => item.startsWith("../styles/")).map(
      (item) => item.replace("../styles/", `${STYLES_DIR}/`),
    );

    expect(cssFiles(STYLES_DIR).sort()).toEqual([...imported].sort());
  });
});
