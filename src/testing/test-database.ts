import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

// Postgres real en memoria para las pruebas de integracion (entrega 11.1):
// PGlite es Postgres compilado a WebAssembly, sin red, sin Docker y sin
// Supabase. Cada archivo de prueba arranca su propia base, construida con las
// mismas migraciones que se despliegan, y la descarta al terminar.
//
// Limite: el servidor de socket atiende todas las conexiones con un unico
// backend de Postgres. Dos transacciones abiertas a la vez se mezclarian en la
// misma sesion, por eso el pool del adaptador tiene una sola conexion. Estas
// pruebas no sirven para probar concurrencia real (bloqueos de fila que
// esperan, dos reclamos simultaneos de la misma clave).

export type TestDatabase = {
  prisma: PrismaClient;
  // Direccion para clientes externos, como el CLI de Prisma.
  connectionString: string;
  stop: () => Promise<void>;
};

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../prisma/migrations", import.meta.url),
);

// Las carpetas de migracion empiezan con su fecha, asi que el orden
// alfabetico es el orden en que Prisma las aplica.
function readMigrations() {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
    .map((name) => ({
      name,
      sql: readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8"),
    }));
}

async function createTestDatabase(): Promise<TestDatabase> {
  const db = await PGlite.create();

  // Supabase trabaja en UTC. La primera migracion crea sus tablas sin
  // nombrar el esquema: en produccion las ubica el search_path que Prisma
  // fija con ?schema=aceros, y aqui hay que fijarlo antes de aplicarlas.
  await db.exec(
    "SET TIME ZONE 'UTC'; CREATE SCHEMA IF NOT EXISTS aceros; SET search_path TO aceros, public;",
  );

  for (const migration of readMigrations()) {
    try {
      await db.exec(migration.sql);
    } catch (error) {
      throw new Error(`No se pudo aplicar la migracion ${migration.name}.`, {
        cause: error,
      });
    }
  }

  // Puerto 0: el sistema elige uno libre, asi varios archivos de prueba
  // pueden correr a la vez sin chocar.
  const server = new PGLiteSocketServer({ db, port: 0, host: "127.0.0.1" });
  await server.start();

  const connectionString = `postgresql://postgres:postgres@${server.getServerConn()}/postgres?sslmode=disable`;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 1 }, { schema: "aceros" }),
  });

  return {
    prisma,
    connectionString,
    stop: async () => {
      await prisma.$disconnect();
      await server.stop();
      await db.close();
    },
  };
}

// Una base por archivo de prueba: Vitest aisla los modulos de cada archivo,
// asi que este estado no se comparte entre archivos.
let current: Promise<TestDatabase> | undefined;

export function getTestDatabase(): Promise<TestDatabase> {
  current ??= createTestDatabase();
  return current;
}

export async function stopTestDatabase() {
  const database = current;
  current = undefined;
  await (await database)?.stop();
}
