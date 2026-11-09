import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const EXCLUDE = ["node_modules/**", ".next/**", "src/generated/**"];

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Ninguna prueba carga un .env real ni se conecta a Supabase. Si algun
    // archivo bajo prueba necesitara variables de entorno, deben definirse
    // aqui mismo como valores dummy, nunca leerse de un .env local o de
    // secretos reales.
    env: {
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**"],
      exclude: ["src/generated/**"],
    },
    // Los proyectos heredan lo de arriba (extends: true). include y exclude
    // van solo en cada proyecto: al heredar, las listas se suman.
    projects: [
      {
        extends: true,
        test: {
          // Pruebas unitarias puras: sin base de datos.
          name: "unit",
          include: [
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "tests/**/*.test.ts",
            "tests/**/*.spec.ts",
            "scripts/**/*.test.ts",
            "scripts/**/*.spec.ts",
          ],
          exclude: [...EXCLUDE, "**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          // Postgres real en memoria (PGlite): src/testing/test-database.ts.
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          exclude: EXCLUDE,
          setupFiles: ["src/testing/integration-setup.ts"],
          // Arrancar la base y aplicar las migraciones toma unos segundos,
          // mas cuando corre junto al resto de la suite.
          hookTimeout: 60_000,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
