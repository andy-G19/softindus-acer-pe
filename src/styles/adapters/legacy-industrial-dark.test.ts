import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

// Adaptador temporal industrial-dark (entrega 8). Estila las pantallas
// antiguas: elementos (campos, tablas, titulos) y bloques con borde. Esta
// prueba es un trinquete: solo deja avanzar en una direccion.
// - Ninguna regla puede pedir una clase que no exista en el codigo: Tailwind
//   solo genera y React solo pinta las clases escritas en src, asi que esa
//   regla no estilaria nada. Cuando una migracion retire el ultimo consumidor
//   de una clase, la prueba falla y pide borrar la regla.
// - El adaptador no crece: retirar reglas obliga a bajar los numeros de abajo
//   en el mismo commit; subirlos significa volver a sobrescribir colores en
//   lugar de usar tokens y componentes.
// La entrega 8 retiro 24 reglas (92 selectores) y 2 selectores sueltos que
// pedian clases ya inexistentes (bg-white, text-slate-700, hover:bg-gray-50...).

const ADAPTER = "src/styles/adapters/legacy-industrial-dark.css";
const PREFIX = ".industrial-dark";
const RULES = 25;
const SELECTORS = 40;

function sourceCorpus(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "generated" || entry.name === "__snapshots__"
        ? []
        : sourceCorpus(fullPath);
    }

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [readFileSync(fullPath, "utf8")]
      : [];
  });
}

// Reglas de primer nivel dentro de @layer utilities, como [selectores, cuerpo].
function parseRules(css: string) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const layer = text.slice(text.indexOf("{") + 1, text.lastIndexOf("}"));
  const rules: Array<{ selectors: string[]; body: string }> = [];
  let depth = 0;
  let start = 0;
  let open = -1;

  for (let i = 0; i < layer.length; i++) {
    if (layer[i] === "{") {
      if (depth === 0) open = i;
      depth++;
    } else if (layer[i] === "}") {
      depth--;
      if (depth === 0) {
        rules.push({
          selectors: splitSelectors(layer.slice(start, open)),
          body: layer.slice(open + 1, i).trim(),
        });
        start = i + 1;
      }
    }
  }

  return rules;
}

// Separa por comas de nivel 0: las de :is(...) y :where(...) no cuentan.
function splitSelectors(text: string) {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of text) {
    if (char === "(" || char === "[") depth++;
    if (char === ")" || char === "]") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  parts.push(current.trim());
  return parts.filter(Boolean);
}

// Clases que pide el selector despues del prefijo, sin escapes (hover\:x -> hover:x).
function requiredClasses(selector: string) {
  return [...selector.slice(PREFIX.length).matchAll(/\.((?:\\.|[\w-])+)/g)].map((match) =>
    match[1].replace(/\\(.)/g, "$1"),
  );
}

describe("adaptador industrial-dark", () => {
  const rules = parseRules(readFileSync(ADAPTER, "utf8"));
  const selectors = rules.flatMap((rule) => rule.selectors);

  it("cada selector esta dentro de .industrial-dark", () => {
    for (const selector of selectors) {
      expect(selector.startsWith(`${PREFIX} `)).toBe(true);
    }
  });

  it("ninguna regla pide una clase que no exista en el codigo", () => {
    const corpus = sourceCorpus("src").join("\n");
    const isUsed = (name: string) =>
      new RegExp(`(?<![\\w:-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`).test(
        corpus,
      );
    const dead = selectors.filter((selector) => !requiredClasses(selector).every(isUsed));

    expect(dead).toEqual([]);
  });

  it("no crece: al retirar reglas se bajan estos numeros, nunca se suben", () => {
    expect({ reglas: rules.length, selectores: selectors.length }).toEqual({
      reglas: RULES,
      selectores: SELECTORS,
    });
  });
});
