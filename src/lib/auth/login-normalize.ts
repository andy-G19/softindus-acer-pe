import { createHash } from "node:crypto";

// Sin "server-only" ni otras dependencias a proposito: funciones puras,
// reutilizadas por src/lib/auth/login-rate-limit.ts y cubiertas por tests
// unitarios que no deben arrastrar Prisma/next-headers/server-only.

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashLoginValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
