import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  notificationCatalogs,
  notificationRegistry,
} from "@/modules/notification-registry";

// Prueba de desfase entre las claves ?toast= que emite el codigo y el registro
// de notificaciones (entrega 7).
//
// Lee el codigo de src como arbol sintactico de TypeScript, no como texto: asi
// un comentario que menciona ?toast= no cuenta como emisor. Reconoce estas
// formas de emitir una clave dentro de un literal de cadena o de plantilla:
// - literal: `${PATH}?toast=client-created`;
// - ternario de dos literales: `?toast=${activo ? "x-activated" : "x-deactivated"}`;
// - variable validada en el mismo archivo con ["a", "b"].includes(variable),
//   tambien tras un prefijo: `?toast=campaign-status-${nextStatus}`;
// - parametro de una funcion del mismo archivo: cada llamada debe pasar un
//   literal, como detailsPath(..., "recipe-detail-created").
// Cualquier otra forma hace fallar la prueba: o se escribe con una de estas o
// se ensena a la prueba a reconocerla.

// Entradas del registro que ningun archivo emite. Se conservan para no cambiar
// lo que muestra una URL antigua con esa clave; retirarlas es un fix aparte.
const CLAVES_SIN_EMISOR: Record<string, string> = {
  "work-order-materials-consumed":
    "Sin emisor desde 5599788: el consumo todo o nada se reemplazo por la entrega, la devolucion y el cierre de materiales.",
};

type Emission = { file: string; key: string };

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "generated" || entry.name === "__snapshots__"
        ? []
        : sourceFiles(fullPath);
    }

    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [fullPath.split(path.sep).join("/")]
      : [];
  });
}

function stringLiterals(node: ts.Node): string[] | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [node.text];
  }

  if (
    ts.isConditionalExpression(node) &&
    ts.isStringLiteral(node.whenTrue) &&
    ts.isStringLiteral(node.whenFalse)
  ) {
    return [node.whenTrue.text, node.whenFalse.text];
  }

  return null;
}

// Valores de una variable validada con ["a", "b"].includes(variable).
function includesValues(source: ts.SourceFile, name: string): string[] | null {
  let values: string[] | null = null;

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "includes" &&
      ts.isArrayLiteralExpression(node.expression.expression) &&
      node.arguments.length === 1 &&
      ts.isIdentifier(node.arguments[0] as ts.Node) &&
      (node.arguments[0] as ts.Identifier).text === name &&
      node.expression.expression.elements.every(ts.isStringLiteral)
    ) {
      values = node.expression.expression.elements.map(
        (element) => (element as ts.StringLiteral).text,
      );
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return values;
}

// Literales que recibe un parametro en cada llamada a su funcion del archivo.
function parameterArguments(source: ts.SourceFile, identifier: ts.Identifier) {
  let owner: ts.Node | undefined = identifier.parent;

  while (owner && !ts.isFunctionDeclaration(owner)) {
    owner = owner.parent;
  }

  if (!owner || !ts.isFunctionDeclaration(owner) || !owner.name) {
    return null;
  }

  const functionName = owner.name.text;
  const index = owner.parameters.findIndex(
    (parameter) => ts.isIdentifier(parameter.name) && parameter.name.text === identifier.text,
  );

  if (index < 0) {
    return null;
  }

  const values: string[] = [];
  let allLiterals = true;

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === functionName
    ) {
      const argument = node.arguments[index];

      if (argument && ts.isStringLiteral(argument)) {
        values.push(argument.text);
      } else {
        allLiterals = false;
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return allLiterals && values.length > 0 ? values : null;
}

function expandExpression(source: ts.SourceFile, expression: ts.Expression) {
  const literals = stringLiterals(expression);

  if (literals) {
    return literals;
  }

  if (ts.isIdentifier(expression)) {
    return (
      includesValues(source, expression.text) ??
      parameterArguments(source, expression)
    );
  }

  return null;
}

function scan() {
  const emissions: Emission[] = [];
  const problems: string[] = [];

  for (const file of sourceFiles("src")) {
    const text = readFileSync(file, "utf8");

    if (!text.includes("toast=")) {
      continue;
    }

    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const where = (node: ts.Node) =>
      `${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

    // Cada tramo de texto de un literal, con la expresion que lo sigue en una
    // plantilla (o null si es el ultimo tramo o un literal simple).
    const inspect = (node: ts.Node, text: string, next: ts.Expression | null) => {
      for (const match of text.matchAll(/toast=([a-z0-9-]*)/g)) {
        const prefix = match[1] as string;
        const end = (match.index ?? 0) + match[0].length;

        if (end === text.length && next) {
          const values = expandExpression(source, next);

          if (values) {
            emissions.push(...values.map((value) => ({ file, key: prefix + value })));
          } else {
            problems.push(`${where(node)}: forma no reconocida ?toast=${prefix}\${${next.getText(source)}}`);
          }
        } else if (prefix && !/^[a-z0-9-]/.test(text.slice(end))) {
          emissions.push({ file, key: prefix });
        } else {
          problems.push(`${where(node)}: forma no reconocida en "${text}"`);
        }
      }
    };

    const visit = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        inspect(node, node.text, null);
      } else if (ts.isTemplateExpression(node)) {
        const spans = node.templateSpans;
        inspect(node, node.head.text, spans[0]?.expression ?? null);
        spans.forEach((span, index) => {
          inspect(node, span.literal.text, spans[index + 1]?.expression ?? null);
        });
      }

      ts.forEachChild(node, visit);
    };

    visit(source);
  }

  return { emissions, problems };
}

const { emissions, problems } = scan();
const registry: Record<string, unknown> = notificationRegistry;
const areaCatalogs: Record<string, Record<string, unknown>> = notificationCatalogs;

describe("claves ?toast= emitidas", () => {
  it("cada ?toast= del codigo tiene una forma reconocida", () => {
    expect(problems).toEqual([]);
  });

  it("cada clave emitida tiene entrada en el registro", () => {
    const missing = emissions.filter(({ key }) => !Object.hasOwn(registry, key));

    expect(
      missing,
      "Agrega la clave al catalogo src/modules/<area>/notifications.ts del area que la emite",
    ).toEqual([]);
  });

  it("cada clave emitida desde src/modules/<area> esta en el catalogo de esa area", () => {
    const misplaced = emissions.flatMap(({ file, key }) => {
      const area = /^src\/modules\/([^/]+)\//.exec(file)?.[1];

      if (!area || !Object.hasOwn(registry, key)) {
        return [];
      }

      const catalog = areaCatalogs[area];

      if (!catalog) {
        return [`${file}: el area ${area} no tiene catalogo en notification-registry.ts`];
      }

      return Object.hasOwn(catalog, key) ? [] : [`${file}: ${key} no esta en el catalogo de ${area}`];
    });

    expect(misplaced).toEqual([]);
  });
});

describe("registro", () => {
  it("cada entrada tiene emisor o figura en CLAVES_SIN_EMISOR", () => {
    const emitted = new Set(emissions.map(({ key }) => key));
    const withoutEmitter = Object.keys(registry).filter((key) => !emitted.has(key));

    expect(withoutEmitter.sort()).toEqual(Object.keys(CLAVES_SIN_EMISOR).sort());
  });

  it("ninguna clave se repite entre areas", () => {
    const areasByKey = new Map<string, string[]>();

    for (const [area, catalog] of Object.entries(areaCatalogs)) {
      for (const key of Object.keys(catalog)) {
        areasByKey.set(key, [...(areasByKey.get(key) ?? []), area]);
      }
    }

    const repeated = [...areasByKey].filter(([, areas]) => areas.length > 1);

    expect(repeated).toEqual([]);
    expect(Object.keys(registry)).toHaveLength(areasByKey.size);
  });
});
