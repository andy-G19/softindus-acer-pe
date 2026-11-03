import { describe, expect, it, vi } from "vitest";

import {
  findActiveUserOptions,
  getUserForEdit,
  getUserListData,
} from "@/modules/users/queries";
import { characterizeHandler, isPrismaCall } from "@/testing/page-characterization";

// La fila de usuario trae clave_hash: ninguna consulta de pagina puede leerla
// completa ni pedir esa columna (10.7b). Cada consulta se ejecuta con Prisma
// simulado y se revisan todas sus lecturas de usuario.

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock(),
);

const CONSULTAS: [string, () => Promise<unknown>][] = [
  ["getUserListData", () => getUserListData({ q: "ana", rol: "SELLER", estado: "activo" }, { skip: 0, take: 10 })],
  ["getUserForEdit", () => getUserForEdit("USU00000002")],
  ["findActiveUserOptions", () => findActiveUserOptions()],
];

describe("consultas de Usuarios", () => {
  it.each(CONSULTAS)("%s elige sus columnas sin clave_hash", async (_name, query) => {
    const { calls } = await characterizeHandler(query);
    const reads = calls
      .filter(isPrismaCall)
      .filter((call) => /^usuario\.(find|aggregate|groupBy)/.test(call.prisma));

    expect(reads.length).toBeGreaterThan(0);

    for (const call of reads) {
      const select = (call.args as { select?: Record<string, unknown> } | undefined)?.select;

      expect(select, `${call.prisma} sin select`).toBeDefined();
      expect(select).not.toHaveProperty("clave_hash");
    }
  });
});
