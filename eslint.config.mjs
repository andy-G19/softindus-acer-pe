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

// Consultas fuera de las paginas (entrega 4): las paginas migradas leen sus
// datos a traves de src/modules/<area>/<funcionalidad>/queries.ts. La lista
// crece con cada sub-entrega.
const pagesWithoutPrisma = [
  "src/app/(dashboard)/dashboard/commercial/**/page.tsx",
  "src/app/(dashboard)/dashboard/inventory/**/page.tsx",
  "src/app/(dashboard)/dashboard/maintenance/**/page.tsx",
  "src/app/(dashboard)/dashboard/staff/**/page.tsx",
  "src/app/(dashboard)/dashboard/users/**/page.tsx",
  "src/app/(dashboard)/dashboard/audit/**/page.tsx",
];

const dbImportRestriction = {
  name: "@/lib/db",
  message:
    "Las paginas no consultan Prisma: mueve la consulta a src/modules/<area>/<funcionalidad>/queries.ts.",
};

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
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/auth.ts", "src/lib/authz.ts", "src/proxy.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [authImportRestriction],
        },
      ],
    },
  },
  // Paginas sin Prisma directo (entrega 4). En flat config, si dos bloques
  // configuran la misma regla para un archivo, el ultimo reemplaza las opciones
  // del anterior: este bloque repite la restriccion de @/auth para no perderla.
  {
    files: pagesWithoutPrisma,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [authImportRestriction, dbImportRestriction],
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
