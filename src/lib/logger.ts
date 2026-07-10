// Logger centralizado sin dependencias externas. Deliberadamente no importa
// "server-only" ni src/lib/env.ts: debe poder importarse desde cualquier
// contexto (Node, Edge/proxy) sin arrastrar el guard de servidor de env.ts
// ni romper un bundle donde se importe por error. Lee NODE_ENV directo de
// process.env, que Next.js define en todos los runtimes.

const SENSITIVE_KEY_FRAGMENTS = [
  "password",
  "clave",
  "token",
  "secret",
  "authorization",
  "cookie",
  "database_url",
  "auth_secret",
];

const REDACTED = "[REDACTED]";
const MAX_SANITIZE_DEPTH = 6;

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();

  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function serializeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    // El stack solo se expone en desarrollo: puede revelar rutas de
    // archivos y estructura interna del servidor.
    ...(isProductionEnv() ? {} : { stack: error.stack }),
  };
}

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  if (value instanceof Error) {
    return serializeError(value);
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return "[MaxDepth]";
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen, depth + 1));
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = isSensitiveKey(key)
        ? REDACTED
        : sanitizeValue(val, seen, depth + 1);
    }

    return result;
  }

  return value;
}

function sanitizeMeta(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!meta) {
    return undefined;
  }

  return sanitizeValue(meta, new WeakSet<object>(), 0) as Record<string, unknown>;
}

type LogLevel = "info" | "warn" | "error" | "debug";

function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  // En produccion no se imprimen logs de debug: son ruido operativo y
  // pueden filtrar detalles internos usados solo en desarrollo.
  if (level === "debug" && isProductionEnv()) {
    return;
  }

  const sanitizedMeta = sanitizeMeta(meta);
  const timestamp = new Date().toISOString();

  if (isProductionEnv()) {
    // Una linea JSON por entrada: mas facil de parsear por un log drain.
    console[level](
      JSON.stringify({
        level,
        message,
        timestamp,
        ...(sanitizedMeta ? { meta: sanitizedMeta } : {}),
      }),
    );

    return;
  }

  if (sanitizedMeta) {
    console[level](`[${timestamp}] ${level.toUpperCase()} ${message}`, sanitizedMeta);
  } else {
    console[level](`[${timestamp}] ${level.toUpperCase()} ${message}`);
  }
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
};
