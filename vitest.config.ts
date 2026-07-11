import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.spec.ts",
      "tests/**/*.test.ts",
      "tests/**/*.spec.ts",
      "scripts/**/*.test.ts",
      "scripts/**/*.spec.ts",
    ],
    exclude: [
      "node_modules/**",
      ".next/**",
      "src/generated/**",
    ],
    // Tests unitarios puros: no se carga ningun .env real ni se conecta a
    // Supabase. Si algun archivo bajo prueba necesitara variables de
    // entorno, deben definirse aqui mismo como valores dummy, nunca leerse
    // de un .env local o de secretos reales.
    env: {
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**"],
      exclude: ["src/generated/**"],
    },
  },
});
