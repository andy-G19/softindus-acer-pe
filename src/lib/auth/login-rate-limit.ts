import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import bcrypt from "bcrypt";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_EMAIL_MAX_FAILURES = 5;
export const LOGIN_IP_MAX_FAILURES = 20;
export const LOGIN_LOCKOUT_MINUTES = 15;
export const LOGIN_ATTEMPT_RETENTION_DAYS = 30;

// Se recalcula sobre una ventana movil de LOGIN_WINDOW_MINUTES: mientras
// sigan existiendo fallos recientes dentro de la ventana, el correo/IP
// permanece bloqueado, lo que en la practica reproduce un bloqueo temporal
// de LOGIN_LOCKOUT_MINUTES desde el ultimo fallo sin necesitar una columna
// de "bloqueado_hasta" aparte.

// Hash bcrypt valido y estatico, generado a partir de un valor aleatorio que
// no es la contraseña de ningun usuario real. Se usa para ejecutar
// bcrypt.compare cuando el usuario no existe o el login ya esta bloqueado,
// de forma que el tiempo de respuesta no revele esos casos.
const DUMMY_PASSWORD_HASH =
  "$2b$10$Lo6zOwXtJhL5F/bXueR7DevAnpIO4WHBljpYTaxYmY.YrWirVVL9y";

const CLEANUP_PROBABILITY = 0.05;

export type LoginAttemptResultado = "exitoso" | "fallido" | "bloqueado";

export type LoginClientContext = {
  ipHash: string | null;
  userAgentHash: string | null;
};

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashLoginValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Lee IP y user-agent de los headers de la peticion actual y devuelve solo
 * sus hashes: nunca se persiste la IP cruda.
 */
export async function getLoginClientContext(): Promise<LoginClientContext> {
  try {
    const headerList = await headers();

    const forwardedFor = headerList.get("x-forwarded-for");
    const realIp = headerList.get("x-real-ip");
    const rawIp = forwardedFor?.split(",")[0]?.trim() || realIp || null;
    const userAgent = headerList.get("user-agent");

    return {
      ipHash: rawIp ? hashLoginValue(rawIp) : null,
      userAgentHash: userAgent ? hashLoginValue(userAgent) : null,
    };
  } catch (error) {
    logger.error(
      "No se pudo leer el contexto de la peticion de login (IP/user-agent).",
      { error },
    );

    return { ipHash: null, userAgentHash: null };
  }
}

async function getRecentLoginStats(
  correoNormalizado: string,
  ipHash: string | null,
): Promise<{ emailFailures: number; ipFailures: number }> {
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);

  const [emailFailures, ipFailures] = await Promise.all([
    prisma.login_attempt.count({
      where: {
        correo_normalizado: correoNormalizado,
        resultado: { in: ["fallido", "bloqueado"] },
        fecha_intento: { gte: windowStart },
      },
    }),
    ipHash
      ? prisma.login_attempt.count({
          where: {
            ip_hash: ipHash,
            resultado: { in: ["fallido", "bloqueado"] },
            fecha_intento: { gte: windowStart },
          },
        })
      : Promise.resolve(0),
  ]);

  return { emailFailures, ipFailures };
}

export type LoginAllowedResult =
  | { allowed: true }
  | { allowed: false; motivo: "rate_limit_correo" | "rate_limit_ip" };

/**
 * Verifica el rate limit antes de intentar autenticar. Ante un error de BD
 * no se garantiza acceso: se trata como no permitido (falla cerrado), igual
 * que la revalidacion de sesion del Bloque 3.
 */
export async function assertLoginAllowed(
  correoNormalizado: string,
  ipHash: string | null,
): Promise<LoginAllowedResult> {
  try {
    const stats = await getRecentLoginStats(correoNormalizado, ipHash);

    if (stats.emailFailures >= LOGIN_EMAIL_MAX_FAILURES) {
      return { allowed: false, motivo: "rate_limit_correo" };
    }

    if (ipHash && stats.ipFailures >= LOGIN_IP_MAX_FAILURES) {
      return { allowed: false, motivo: "rate_limit_ip" };
    }

    return { allowed: true };
  } catch (error) {
    logger.error("No se pudo verificar el rate limit de login.", {
      error,
      correoNormalizado,
    });

    return { allowed: false, motivo: "rate_limit_correo" };
  }
}

type RecordLoginAttemptInput = {
  correoNormalizado: string;
  ipHash: string | null;
  userAgentHash: string | null;
  resultado: LoginAttemptResultado;
  motivo?: string;
};

/**
 * Registra el intento de login. Nunca debe abrir acceso ni romper el login:
 * un fallo aqui solo se reporta por consola.
 */
export async function recordLoginAttempt(
  input: RecordLoginAttemptInput,
): Promise<void> {
  try {
    await prisma.login_attempt.create({
      data: {
        correo_normalizado: input.correoNormalizado,
        ip_hash: input.ipHash,
        user_agent_hash: input.userAgentHash,
        resultado: input.resultado,
        motivo: input.motivo ?? null,
      },
    });
  } catch (error) {
    logger.error("No se pudo registrar el intento de login.", {
      error,
      correoNormalizado: input.correoNormalizado,
      resultado: input.resultado,
    });
  }

  void cleanupOldLoginAttempts();
}

/**
 * Ejecuta bcrypt.compare contra un hash dummy fijo, para que el tiempo de
 * respuesta de un login con usuario inexistente/bloqueado sea equivalente al
 * de una comparacion real y no sirva para enumerar usuarios.
 */
export async function runDummyPasswordCompare(password: string): Promise<void> {
  try {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
  } catch (error) {
    logger.error("No se pudo ejecutar la comparacion dummy de login.", { error });
  }
}

/**
 * Limpieza de retencion no bloqueante: se ejecuta con baja probabilidad en
 * cada intento registrado para evitar un DELETE en cada login, sin depender
 * de un cron job.
 */
async function cleanupOldLoginAttempts(): Promise<void> {
  if (Math.random() > CLEANUP_PROBABILITY) {
    return;
  }

  try {
    const retentionCutoff = new Date(
      Date.now() - LOGIN_ATTEMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    await prisma.login_attempt.deleteMany({
      where: {
        fecha_intento: { lt: retentionCutoff },
      },
    });
  } catch (error) {
    logger.error("No se pudo limpiar intentos de login antiguos.", { error });
  }
}
