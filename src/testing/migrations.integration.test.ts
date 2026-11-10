import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getTestDatabase } from "@/testing/test-database";

// Las migraciones construyen exactamente lo que modela schema.prisma.
//
// La base en memoria se arma aplicando prisma/migrations en orden, como en
// Supabase. Prisma la compara con schema.prisma (migrate diff) y devuelve el
// SQL que haria falta para igualarlas. Si alguien cambia el modelo sin crear
// su migracion, o una migracion crea algo que el modelo no conoce, aparece
// aqui una instruccion nueva y la prueba falla. Todas las demas pruebas de
// integracion confian en esta: prueban la base que de verdad se despliega.

// Diferencias conocidas e intencionales. Cada una explica por que no se
// corrige. No se agrega una sin decidirlo.
const KNOWN_DIFFERENCES = [
  // La migracion 20260711120000 crea a proposito el indice parcial unico
  // uq_version_receta_vigente («una sola version vigente por receta»), que
  // schema.prisma no modela. Prisma propone borrarlo; borrarlo permitiria dos
  // versiones vigentes de la misma receta. No se debe "arreglar".
  'DROP INDEX "uq_version_receta_vigente";',
];

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PRISMA_CLI = join(ROOT, "node_modules", "prisma", "build", "index.js");
const SCHEMA = join(ROOT, "prisma", "schema.prisma");

let workDir: string;

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "aceros-migraciones-"));
});

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

type CliResult = { code: number | null; stdout: string; stderr: string };

// spawn y no spawnSync: la base en memoria atiende el socket en este mismo
// proceso, y spawnSync lo bloquearia mientras el CLI intenta conectarse.
function runPrismaCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [PRISMA_CLI, ...args], {
      cwd: workDir,
      // Entorno minimo: sin DATABASE_URL heredado y sin chequeos de version
      // por red. Next declara NODE_ENV obligatorio en el tipo del entorno.
      env: {
        NODE_ENV: "test",
        PATH: process.env.PATH,
        SYSTEMROOT: process.env.SYSTEMROOT,
        CHECKPOINT_DISABLE: "1",
        PRISMA_HIDE_UPDATE_MESSAGE: "1",
      },
      timeout: 90_000,
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

// Solo las instrucciones SQL: sin los comentarios que Prisma agrega como
// titulo de cada cambio ni lineas vacias.
function sqlStatements(script: string) {
  return script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("--"));
}

describe("migraciones y schema.prisma", () => {
  it(
    "las migraciones construyen el modelo, salvo las diferencias conocidas",
    async () => {
      const { connectionString } = await getTestDatabase();

      // Configuracion propia: la de la raiz importa dotenv y leeria el .env.
      const config = join(workDir, "prisma.config.mjs");
      writeFileSync(
        config,
        `export default ${JSON.stringify({
          schema: SCHEMA,
          datasource: { url: `${connectionString}&schema=aceros` },
        })};\n`,
      );

      const result = await runPrismaCli([
        "migrate",
        "diff",
        "--config",
        config,
        "--from-config-datasource",
        "--to-schema",
        SCHEMA,
        "--script",
      ]);

      expect(result.code, result.stderr).toBe(0);
      expect(sqlStatements(result.stdout)).toEqual(KNOWN_DIFFERENCES);
    },
    120_000,
  );
});
