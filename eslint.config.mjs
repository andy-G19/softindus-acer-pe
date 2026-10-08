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
          paths: [authImportRestriction, ...notificationLibraryRestrictions],
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
            ...notificationLibraryRestrictions,
          ],
          patterns: notificationLibraryPatterns,
        },
      ],
    },
  },
  // La fachada de notificaciones y el proveedor de toasts son los unicos que
  // importan SweetAlert2 y Toastify. Por la misma regla de reemplazo, este
  // bloque conserva para ellos solo la restriccion de @/auth.
  {
    files: notificationFacadeFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [authImportRestriction],
        },
      ],
    },
  },
  // Conversion y formatos compartidos (entrega 3): habia 153 copias locales con
  // comportamientos distintos bajo el mismo nombre. Cada una vive en un solo lugar.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/numbers.ts", "src/lib/formatters.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "FunctionDeclaration[id.name=/^(toNumber|toNonNegativeNumber|formatMoney|formatDate)$/]",
          message:
            "Importa toNumber y toNonNegativeNumber de @/lib/numbers, y formatMoney y formatDate de @/lib/formatters, en lugar de definir una copia local.",
        },
        {
          selector:
            "VariableDeclarator[id.name=/^(toNumber|toNonNegativeNumber|formatMoney|formatDate)$/]",
          message:
            "Importa toNumber y toNonNegativeNumber de @/lib/numbers, y formatMoney y formatDate de @/lib/formatters, en lugar de definir una copia local.",
        },
      ],
    },
  },
]);

export default eslintConfig;
