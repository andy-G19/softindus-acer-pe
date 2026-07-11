import "dotenv/config";

import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { getNextCorrelativeId } from "@/lib/correlatives-core";
import { APP_ROLES } from "@/lib/permissions";
import { parseBootstrapAdminConfig } from "./bootstrap-admin-config";

// Script manual y excepcional: crea unicamente el primer usuario ADMIN en
// una base de datos nueva. No se ejecuta desde postinstall, build, dev ni
// ningun pipeline de despliegue. Aborta sin escribir nada si ya existe
// cualquier usuario ADMIN o si hay colision de correo/usuario.
//
// No importa "@/lib/db", "@/lib/env" ni "@/lib/correlatives": esos modulos
// importan el paquete "server-only", que Next.js resuelve mediante su
// bundler pero que no existe como paquete real en node_modules, por lo que
// falla al ejecutar este script con tsx/node directamente. El generador de
// correlativos se reutiliza desde src/lib/correlatives-core.ts, que no
// depende de "server-only" y es la MISMA implementacion que usa la app.

const BCRYPT_COST = 10; // Mismo costo usado en src/modules/users/actions.ts.
const CORRELATIVE_CODIGO_ENTIDAD = "usuario";
const CORRELATIVE_PREFIJO = "USU";

// Clave arbitraria y no sensible (no es un secreto: es solo un identificador
// de namespace para el advisory lock). Se hashea con hashtext() dentro de
// Postgres para obtener el bigint que exige pg_advisory_xact_lock.
const BOOTSTRAP_ADMIN_LOCK_KEY = "aceros.bootstrap.initial_admin";

function reportFailure(message: string): void {
  console.error(message);
  process.exitCode = 1;
}

function getGenericErrorMessage(error: unknown): string {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "Ya existe un usuario con ese correo o nombre de usuario.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "No se pudo crear el administrador inicial.";
}

async function main() {
  const configResult = parseBootstrapAdminConfig(process.env);

  if (!configResult.success) {
    reportFailure(
      `Configuracion de bootstrap invalida. Variables afectadas: ${configResult.errors.join("; ")}`,
    );
    return;
  }

  const config = configResult.data;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    reportFailure("DATABASE_URL no esta definida en el entorno.");
    return;
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (tx) => {
      // Advisory transaction lock: serializa cualquier ejecucion concurrente
      // de este script. Sin este lock, dos bootstraps corriendo al mismo
      // tiempo podrian pasar ambos la verificacion "no existe ADMIN" antes
      // de que ninguno haya insertado su usuario, creando dos administradores
      // iniciales. El lock se libera automaticamente al terminar la
      // transaccion (commit o rollback), sin necesidad de liberarlo a mano.
      await tx.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtext(${BOOTSTRAP_ADMIN_LOCK_KEY}))
      `);

      const adminRole = await tx.rol.findFirst({
        where: { nombre_rol: APP_ROLES.ADMIN, estado: true },
        select: { id_rol: true },
      });

      if (!adminRole) {
        throw new Error(
          "No existe un rol ADMIN activo. Ejecute primero el seed estructural (npm run db:seed).",
        );
      }

      const existingAdmin = await tx.usuario.findFirst({
        where: { rol: { nombre_rol: APP_ROLES.ADMIN } },
        select: { id_usuario: true },
      });

      if (existingAdmin) {
        throw new Error(
          "Ya existe un usuario con rol ADMIN. El bootstrap no realiza cambios.",
        );
      }

      const duplicate = await tx.usuario.findFirst({
        where: {
          OR: [
            { correo: config.BOOTSTRAP_ADMIN_EMAIL },
            { usuario: config.BOOTSTRAP_ADMIN_USERNAME },
          ],
        },
        select: { id_usuario: true },
      });

      if (duplicate) {
        throw new Error(
          "Ya existe un usuario con ese correo o nombre de usuario. El bootstrap no realiza cambios.",
        );
      }

      const idUsuario = await getNextCorrelativeId(tx, {
        codigoEntidad: CORRELATIVE_CODIGO_ENTIDAD,
        prefijo: CORRELATIVE_PREFIJO,
      });

      const claveHash = await bcrypt.hash(config.BOOTSTRAP_ADMIN_PASSWORD, BCRYPT_COST);

      await tx.usuario.create({
        data: {
          id_usuario: idUsuario,
          id_rol: adminRole.id_rol,
          nombres: config.BOOTSTRAP_ADMIN_NAMES,
          apellidos: config.BOOTSTRAP_ADMIN_SURNAMES,
          usuario: config.BOOTSTRAP_ADMIN_USERNAME,
          correo: config.BOOTSTRAP_ADMIN_EMAIL,
          clave_hash: claveHash,
          estado: "activo",
        },
      });
    });

    console.log("Administrador inicial creado correctamente.");
  } catch (error) {
    reportFailure(getGenericErrorMessage(error));
  } finally {
    await prisma.$disconnect();
  }
}

main();
