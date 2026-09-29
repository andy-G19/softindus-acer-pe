import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const slash = (path) => path.split(sep).join("/");

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "generated") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(path);
  }
  return files.sort();
}

const pages = [];
const forms = [];
const actions = [];
const modules = new Map();
const paths = await sourceFiles(join(root, "src"));

for (const path of paths) {
  const file = slash(relative(root, path));
  const text = await readFile(path, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const isPage = file.startsWith("src/app/") && file.endsWith("/page.tsx");
  const isServerAction = source.statements.some((statement) =>
    ts.isExpressionStatement(statement) &&
    ts.isStringLiteral(statement.expression) &&
    statement.expression.text === "use server",
  );
  const imports = [];
  const pageForms = [];
  const exports = [];
  const area = file.match(/^src\/app\/\(dashboard\)\/dashboard\/([^/]+)\//)?.[1]
    ?? (file.includes("/(auth)/") ? "auth" : "inicio");

  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (/(Form|Manager)$/.test(element.name.text)) imports.push(element.name.text);
        }
      }
    }
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(source) === "form") {
      const action = node.attributes.properties.find((attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(source) === "action",
      );
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const actionText = action?.initializer?.getText(source).replace(/\s+/g, " ")
        ?? "Sin action explícita (revisar filtros/onSubmit)";
      forms.push({ file, line, action: actionText });
      pageForms.push(line);
    }
    if (isServerAction && ts.isFunctionDeclaration(node) && node.name &&
      node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      exports.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  if (isPage) {
    const route = "/" + file.slice("src/app/".length, -"/page.tsx".length)
      .split("/").filter((segment) => !segment.startsWith("(")).join("/");
    pages.push({ file, route, area, inline: pageForms.length, imports });
    modules.set(area, (modules.get(area) ?? 0) + 1);
  }
  if (isServerAction) actions.push({ file, exports });
}

const cell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
const table = (headers, rows) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
].join("\n");
const output = [
  "# Inventario estructural para la refactorización",
  "Generado con `npm run refactor:inventory`. No editar las tablas a mano.",
  "Este inventario analiza el árbol sintáctico de `src`, excluyendo el cliente generado. " +
    "Cuenta declaraciones JSX de formularios, incluidos filtros y acciones por fila; " +
    "no equivale al número de pantallas de alta/edición. Los componentes importados son " +
    "candidatos por nombre y requieren clasificación funcional en el piloto. " +
    "El seguimiento manual se mantiene en `SEGUIMIENTO.md`.",
  table(["Medida", "Cantidad"], [
    ["Archivos fuente analizados", paths.length],
    ["Páginas", pages.length],
    ["Declaraciones JSX de formulario", forms.length],
    ["Archivos con directiva use server", actions.length],
    ["Funciones exportadas en esos archivos", actions.reduce((n, row) => n + row.exports.length, 0)],
  ]),
  "## Páginas por área",
  table(["Área", "Páginas"], [...modules].sort(([a], [b]) => a.localeCompare(b))),
  "## Rutas y formularios candidatos",
  table(["Ruta", "Fuente", "Formularios inline", "Componentes candidatos"], pages.map((page) => [
    `\`${page.route}\``, `\`${page.file}\``, page.inline, page.imports.join(", ") || "—",
  ])),
  "## Declaraciones de formularios",
  table(["Fuente", "Línea", "Acción"], forms.map((form) => [
    `\`${form.file}\``, form.line, `\`${form.action}\``,
  ])),
  "## Entradas de servidor",
  table(["Fuente", "Funciones exportadas"], actions.map((action) => [
    `\`${action.file}\``, action.exports.join(", ") || "Revisar exports indirectos",
  ])),
  "",
].join("\n\n");

const target = join(root, "docs/refactoring/INVENTARIO.md");
await mkdir(dirname(target), { recursive: true });
await writeFile(target, output, "utf8");
console.log(`Inventario: ${pages.length} páginas, ${forms.length} formularios JSX, ${actions.length} archivos de acciones.`);
console.log(slash(relative(root, target)));
