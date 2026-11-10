import { afterAll, vi } from "vitest";

import { stopTestDatabase } from "@/testing/test-database";

// Preparacion de cada archivo del proyecto "integration" de Vitest.

// "server-only" solo se resuelve dentro del bundler de Next.
vi.mock("server-only", () => ({}));

// El codigo bajo prueba importa prisma de @/lib/db, como en la app; aqui
// recibe el cliente de la base en memoria. No se toca globalThis.prisma ni se
// carga @/lib/env, que exigiria un DATABASE_URL real.
vi.mock("@/lib/db", async () => {
  const { getTestDatabase } = await import("@/testing/test-database");
  return { prisma: (await getTestDatabase()).prisma };
});

afterAll(stopTestDatabase);
