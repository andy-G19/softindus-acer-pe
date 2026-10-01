import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
          paths: [
            {
              name: "@/auth",
              importNames: ["auth"],
              message:
                "Usa los helpers de @/lib/authz (requireRole, getAuthorizedSession, requireApiRole): revalidan el usuario activo y registran los rechazos.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
