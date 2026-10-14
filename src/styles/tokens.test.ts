import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Tokens de la identidad visual (entrega 8). Cada token se define una sola vez
// en :root de tokens.css; el resto de las hojas los usa con var() y no escribe
// colores literales. Una variable mal escrita no da error en CSS: la
// declaracion simplemente se ignora y el elemento pierde su color sin aviso,
// por eso se exige que cada var() apunte a algo definido.

const TOKENS = "src/styles/tokens.css";
const STYLES_DIR = "src/styles";
const LAYOUT = "src/app/layout.tsx";

// Familias que pide la seccion 4 del plan: fondo, superficie, texto, borde,
// primario, estados, foco, radios, sombras, capas y movimiento. La tipografia
// llega de next/font y el espaciado es la escala de Tailwind.
const REQUIRED = [
  "--background",
  "--card",
  "--popover",
  "--foreground",
  "--muted-foreground",
  "--border",
  "--input",
  "--primary",
  "--success",
  "--warning",
  "--info",
  "--destructive",
  "--ring",
  "--radius",
  "--shadow-raised",
  "--z-header",
  "--z-overlay",
  "--motion-fast",
];

function withoutComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function block(css: string, opening: string) {
  const start = css.indexOf(opening);
  if (start === -1) return "";
  return css.slice(start + opening.length, css.indexOf("\n}", start));
}

function definitions(text: string) {
  return [...text.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]);
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

describe("tokens", () => {
  const tokens = withoutComments(readFileSync(TOKENS, "utf8"));
  const root = definitions(block(tokens, ":root {"));
  const theme = definitions(block(tokens, "@theme inline {"));
  // Variables que crea next/font en el layout (variable: "--font-...").
  const fontVariables = [...readFileSync(LAYOUT, "utf8").matchAll(/variable: "(--[\w-]+)"/g)].map(
    (match) => match[1],
  );

  it("cada token se define una sola vez, en :root", () => {
    expect(root.filter((name, index) => root.indexOf(name) !== index)).toEqual([]);
    expect(tokens).not.toMatch(/\.dark\s*\{/);
  });

  it("existen los tokens que pide el plan", () => {
    expect(REQUIRED.filter((name) => !root.includes(name))).toEqual([]);
  });

  it("cada var() de las hojas apunta a un token definido", () => {
    const known = new Set([...root, ...theme, ...fontVariables]);
    const undefinedVars = cssFiles(STYLES_DIR).flatMap((file) =>
      [...withoutComments(readFileSync(file, "utf8")).matchAll(/var\((--[\w-]+)/g)]
        .map((match) => match[1])
        .filter((name) => !name.startsWith("--tw-") && !known.has(name))
        .map((name) => `${file}: ${name}`),
    );

    expect(undefinedVars).toEqual([]);
  });

  it("fuera de tokens.css las hojas no escriben colores literales", () => {
    const literals = cssFiles(STYLES_DIR)
      .filter((file) => file !== TOKENS)
      .flatMap((file) =>
        [...withoutComments(readFileSync(file, "utf8")).matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/g)].map(
          (match) => `${file}: ${match[0]}`,
        ),
      );

    expect(literals).toEqual([]);
  });
});
