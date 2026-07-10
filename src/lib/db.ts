import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env, isProduction } from "@/lib/env";

// env.ts ya valida que DATABASE_URL exista y falla temprano si falta: no
// hace falta repetir el chequeo aqui.
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
});

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}