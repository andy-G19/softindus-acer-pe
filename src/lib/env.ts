import "server-only";

import { z } from "zod";

// Solo variables de servidor: este modulo nunca debe ser importado desde
// codigo cliente (el import "server-only" de arriba lo impide en build).
// No hay variables NEXT_PUBLIC_* en este proyecto; si se agregan, deben
// validarse en un schema separado que sea seguro exponer al cliente.
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatoria."),
  // Reservada para conexion directa (migraciones/mantenimiento en Supabase).
  // Hoy no la consume codigo de la app: prisma.config.ts sigue leyendo
  // process.env.DATABASE_URL directamente porque el Prisma CLI carga ese
  // archivo fuera de Next.js, sin pasar por este modulo.
  DIRECT_URL: z.string().min(1).optional(),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET es obligatoria."),
  // Opcionales: Auth.js puede resolver el host mediante AUTH_TRUST_HOST
  // (por ejemplo, en Vercel) sin necesidad de fijar AUTH_URL.
  AUTH_URL: z.string().min(1).optional(),
  AUTH_TRUST_HOST: z
    .string()
    .optional()
    .transform((value) => value === "true" || value === "1"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    // Solo se informan los nombres de las variables invalidas/faltantes,
    // nunca sus valores: evita filtrar secretos en el log de arranque.
    const invalidKeys = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "env"))),
    ];

    console.error(
      `Configuracion de entorno invalida. Variables afectadas: ${invalidKeys.join(", ")}.`,
    );

    throw new Error(
      `No se pudo iniciar la aplicacion: variables de entorno invalidas o faltantes (${invalidKeys.join(", ")}).`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";
