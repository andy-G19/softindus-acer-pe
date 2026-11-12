import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  definePageSuite,
  generatedResult,
  isPrismaCall,
  type PrismaArgs,
} from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock(),
);
vi.mock("@/lib/authz", async () =>
  (await import("@/testing/page-characterization")).authzModuleMock(),
);
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);

// Caracterizacion de Comprobantes (entrega 4.2), escrita antes de mover su
// consulta a modules/commercial/receipts/queries.ts.
//
// Entrega 10.4b: lo que pasa hoy con las fechas y los estados antes de pasar
// la barra a FilterBar y DateRangeFields y el estado a Badge (detalle de las
// fechas en orders-pages.test.ts). Los datos generados dan un estado que no
// existe: la lista nunca mostraba «Emitido» ni «Anulado», ni un comprobante
// sin «Anular».
const RECEIPTS_BY_STATUS = (args: PrismaArgs) => {
  const [withQuote, withoutQuote] = generatedResult("comprobante_venta", "findMany", args) as Record<
    string,
    unknown
  >[];

  return [
    { ...withQuote, estado: "emitido" },
    { ...withQuote, id_comprobante: "CVE00000012", numero_comprobante: "B001-0012", estado: "anulado" },
    { ...withoutQuote, estado: "emitido" },
  ];
};

definePageSuite([
  {
    route: "/dashboard/commercial/receipts",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "B001",
          type: "boleta",
          status: "emitido",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      {
        name: "rango invertido",
        searchParams: { from: "2026-07-31", to: "2026-07-01" },
        data: { "comprobante_venta.findMany": [], "comprobante_venta.count": 0 },
      },
      {
        name: "fechas no validas",
        searchParams: { from: "2026-02-30", to: "2026-07-32" },
      },
      { name: "un comprobante por estado", data: { "comprobante_venta.findMany": RECEIPTS_BY_STATUS } },
    ],
  },
]);

// C4 de la 11.3c (D38, hallazgo 9 de la 10.4a): la lista cargaba todas las filas de una vez. Ahora
// pagina como pagos a proveedores: 20 por pagina, con el total contado aparte con el mismo filtro y
// un orden completo (fecha y luego id), porque la fecha es un dia y las filas del mismo dia
// empatan.
describe("C4 de la 11.3c: comprobantes paginados", () => {
  it("la segunda pagina pide las filas 21 a 40 y cuenta el total con el mismo filtro", async () => {
    const { calls, html } = await characterizePage(
      () => import("./page"),
      { name: "segunda pagina", searchParams: { page: "2", status: "emitido" } },
      "/dashboard/commercial/receipts",
    );

    const prismaCalls = calls.filter(isPrismaCall);
    const list = prismaCalls.find((call) => call.prisma === "comprobante_venta.findMany");
    const count = prismaCalls.find((call) => call.prisma === "comprobante_venta.count");
    const listArgs = list?.args as { where?: unknown; skip?: number; take?: number; orderBy?: unknown };

    expect(listArgs).toMatchObject({
      skip: 20,
      take: 20,
      orderBy: [{ fecha_emision: "desc" }, { id_comprobante: "desc" }],
    });
    expect(count?.args).toEqual({ where: listArgs.where });
    expect(html).toContain("comprobantes");
    expect(html).toMatch(/P[áa]gina 2/);
  });
});
