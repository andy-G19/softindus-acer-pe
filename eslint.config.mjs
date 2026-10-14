import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Autorizacion centralizada (entrega 2): la sesion se obtiene solo a traves
// de los helpers de src/lib/authz.ts.
const authImportRestriction = {
  name: "@/auth",
  importNames: ["auth"],
  message:
    "Usa los helpers de @/lib/authz (requireRole, getAuthorizedSession, requireApiRole): revalidan el usuario activo y registran los rechazos.",
};

// Consultas fuera de las paginas (entregas 4 a 6): las paginas leen sus datos a
// traves de src/modules/<area>/<funcionalidad>/queries.ts. La regla cubre todas
// las paginas, tambien las nuevas, sin excepciones: las ultimas (ordenes de
// trabajo y costos) salieron en la entrega 6.
const pagesWithoutPrisma = ["src/app/**/page.tsx"];

const dbImportRestriction = {
  name: "@/lib/db",
  message:
    "Las paginas no consultan Prisma: mueve la consulta a src/modules/<area>/<funcionalidad>/queries.ts.",
};

// Fachada de notificaciones (entrega 7): SweetAlert2 y Toastify solo se
// importan en src/lib/notifications.ts y en el proveedor de toasts. El resto
// del codigo notifica a traves de la fachada; cambiar de libreria toca un solo
// archivo.
const notificationFacadeFiles = [
  "src/lib/notifications.ts",
  "src/components/notifications/notification-provider.tsx",
];

const notificationLibraryMessage =
  "Usa la fachada @/lib/notifications (notify, showSuccess, showError, showConfirm...): solo ella y el proveedor de toasts importan SweetAlert2 y Toastify.";

const notificationLibraryRestrictions = [
  { name: "sweetalert2", message: notificationLibraryMessage },
  { name: "react-toastify", message: notificationLibraryMessage },
];

const notificationLibraryPatterns = [
  { group: ["sweetalert2/*", "react-toastify/*"], message: notificationLibraryMessage },
];

// Fuentes alojadas en el repositorio (entrega 8): next/font/google las
// descargaba en cada build y un fallo de esa descarga rompio un despliegue de
// produccion. Va en los tres bloques de no-restricted-imports, porque cada
// bloque reemplaza las opciones del anterior.
const googleFontImportRestriction = {
  name: "next/font/google",
  message:
    "Usa next/font/local con un archivo de src/app/fonts (ver su README): el build no debe depender de descargar fuentes de Google.",
};

const apiLinkMessage =
  "Un enlace a /api/ (por ejemplo, una exportacion) va en un <a>, no en <Link>: en produccion next/link hace prefetch con un GET que ejecuta la ruta.";

const sharedHelperMessage =
  "Importa toNumber y toNonNegativeNumber de @/lib/numbers, y formatMoney y formatDate de @/lib/formatters, en lugar de definir una copia local.";

const sharedHelperSelectors = [
  {
    selector:
      "FunctionDeclaration[id.name=/^(toNumber|toNonNegativeNumber|formatMoney|formatDate)$/]",
    message: sharedHelperMessage,
  },
  {
    selector:
      "VariableDeclarator[id.name=/^(toNumber|toNonNegativeNumber|formatMoney|formatDate)$/]",
    message: sharedHelperMessage,
  },
];

const apiLinkSelectors = [
  {
    selector:
      "JSXOpeningElement[name.name='Link'] > JSXAttribute[name.name='href'] > JSXExpressionContainer > CallExpression[callee.name='buildReportExportHref']",
    message: apiLinkMessage,
  },
  {
    selector:
      "JSXOpeningElement[name.name='Link'] > JSXAttribute[name.name='href'] > Literal[value=/^\\/api\\//]",
    message: apiLinkMessage,
  },
  {
    selector:
      "JSXOpeningElement[name.name='Link'] > JSXAttribute[name.name='href'] > JSXExpressionContainer > TemplateLiteral > TemplateElement:first-child[value.raw=/^\\/api\\//]",
    message: apiLinkMessage,
  },
];

// Colores literales (entrega 8): clases de la paleta de Tailwind (text-red-200,
// bg-white...), hexadecimales (#0f1011, tambien en bg-[#...]) y funciones de
// color (rgba(), oklch()...).
const colorLiteralPattern = String.raw`(^|[^\w-])(bg|text|border|ring|shadow|from|to|via|fill|stroke|outline|divide|placeholder|caret|accent|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]|(^|[^\w-])(bg|text|border|ring|fill|stroke|outline)-(white|black)([^\w-]|$)|#[0-9a-fA-F]{3,8}([^\w-]|$)|(rgba?|hsla?|oklch|oklab)\(`;

const colorLiteralMessage =
  "Usa un token de src/styles/tokens.css (bg-shell, text-destructive-foreground, shadow-raised, var(--success)...) en lugar de un color literal; si falta, agregalo alli con su nombre y su papel.";

const colorLiteralSelectors = [
  { selector: `Literal[value=/${colorLiteralPattern}/]`, message: colorLiteralMessage },
  {
    selector: `TemplateElement[value.raw=/${colorLiteralPattern}/]`,
    message: colorLiteralMessage,
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reporte generado por `npm run test:coverage` (Bloque 7): no es codigo
    // fuente, no debe lintearse.
    "coverage/**",
    "src/generated/**",
    "tmp/**",
    "output/**",
    "outputs/**",
    ".agents/**",
    ".claude/**",
    ".codex/**",
    ".codex-finalizer/**",
  ]),
  // Autorizacion centralizada (entrega 2): la sesion se obtiene solo a traves
  // de los helpers de src/lib/authz.ts, que revalidan el usuario activo y
  // registran los rechazos. signIn, signOut y handlers siguen permitidos.
  // Tambien restringe las librerias de notificacion (entrega 7).
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/auth.ts", "src/lib/authz.ts", "src/proxy.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            authImportRestriction,
            googleFontImportRestriction,
            ...notificationLibraryRestrictions,
          ],
          patterns: notificationLibraryPatterns,
        },
      ],
    },
  },
  // Paginas sin Prisma directo (entrega 4). En flat config, si dos bloques
  // configuran la misma regla para un archivo, el ultimo reemplaza las opciones
  // del anterior: este bloque repite las restricciones del bloque general para
  // no perderlas.
  {
    files: pagesWithoutPrisma,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            authImportRestriction,
            dbImportRestriction,
            googleFontImportRestriction,
            ...notificationLibraryRestrictions,
          ],
          patterns: notificationLibraryPatterns,
        },
      ],
    },
  },
  // La fachada de notificaciones y el proveedor de toasts son los unicos que
  // importan SweetAlert2 y Toastify. Por la misma regla de reemplazo, este
  // bloque conserva para ellos las restricciones de @/auth y de las fuentes.
  {
    files: notificationFacadeFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [authImportRestriction, googleFontImportRestriction],
        },
      ],
    },
  },
  // Conversion y formatos compartidos (entrega 3): habia 153 copias locales con
  // comportamientos distintos bajo el mismo nombre. Cada una vive en un solo lugar.
  // Tambien prohibe <Link> hacia una ruta de /api/ (grupo 4 de fixes): en el
  // build de produccion next/link hace prefetch de cada enlace visible con un
  // GET, y en la exportacion de reportes ese GET registraba una exportacion
  // que nadie pidio. Va en el mismo bloque porque un segundo bloque con
  // no-restricted-syntax reemplazaria las opciones de este.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/numbers.ts", "src/lib/formatters.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...sharedHelperSelectors, ...apiLinkSelectors],
    },
  },
  // Colores literales en la interfaz (entrega 8): los componentes usan los
  // tokens de src/styles/tokens.css. Solo cubre .tsx: los colores de los PDF y
  // Excel (src/lib/*-export.ts) no son de la interfaz. Por la regla de
  // reemplazo, este bloque repite las restricciones del bloque anterior.
  {
    files: ["src/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...sharedHelperSelectors,
        ...apiLinkSelectors,
        ...colorLiteralSelectors,
      ],
    },
  },
]);

export default eslintConfig;
