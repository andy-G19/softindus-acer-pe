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

// Caracterizacion de Pagos de clientes (entrega 4.2), escrita antes de mover
// sus consultas a modules/commercial/payments/queries.ts.
//
// Entrega 10.4b: lo que pasa hoy con las fechas antes de pasar la barra a
// FilterBar y DateRangeFields (detalle en orders-pages.test.ts). Los datos
// generados dan un tipo y un metodo que no existen: el caso con valores
// reales fijaba que la tabla los mostraba tal como se guardan
// («amortizacion»). Desde C2 de la 11.3c (hallazgo 4 de la 10.4b) muestra el
// texto de los filtros («Amortización»): ver payment-labels-pages.test.ts.
const PAYMENTS_WITH_REAL_VALUES = (args: PrismaArgs) => {
  const [first, second] = generatedResult("pago_cliente", "findMany", args) as Record<string, unknown>[];

  return [
    { ...first, tipo_pago: "adelanto", metodo_pago: "efectivo" },
    { ...second, tipo_pago: "amortizacion", metodo_pago: "transferencia" },
    { ...first, id_pago_cliente: "PCL00000013", tipo_pago: "cancelacion", metodo_pago: "yape" },
  ];
};

definePageSuite([
  {
    route: "/dashboard/commercial/payments",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "PRO",
          client: "CLI00000001",
          order: "PED00000001",
          method: "efectivo",
          type: "adelanto",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      {
        name: "rango invertido",
        searchParams: { from: "2026-07-31", to: "2026-07-01" },
        data: { "pago_cliente.findMany": [], "pago_cliente.count": 0 },
      },
      {
        name: "fechas no validas",
        searchParams: { from: "2026-02-30", to: "2026-07-32" },
      },
      {
        name: "tipos y metodos reales",
        data: { "pago_cliente.findMany": PAYMENTS_WITH_REAL_VALUES },
      },
    ],
  },
]);

// C4 de la 11.3c (D38, hallazgo 9 de la 10.4a): la lista cargaba todas las filas de una vez. Ahora
// pagina como pagos a proveedores: 20 por pagina, con el total contado aparte con el mismo filtro y
// un orden completo (fecha y luego id), porque la fecha es un dia y las filas del mismo dia
// empatan.
describe("C4 de la 11.3c: pagos paginados", () => {
  it("la segunda pagina pide las filas 21 a 40 y cuenta el total con el mismo filtro", async () => {
    const { calls, html } = await characterizePage(
      () => import("./page"),
      { name: "segunda pagina", searchParams: { page: "2", method: "yape" } },
      "/dashboard/commercial/payments",
    );

    const prismaCalls = calls.filter(isPrismaCall);
    const list = prismaCalls.find((call) => call.prisma === "pago_cliente.findMany");
    const count = prismaCalls.find((call) => call.prisma === "pago_cliente.count");
    const listArgs = list?.args as { where?: unknown; skip?: number; take?: number; orderBy?: unknown };

    expect(listArgs).toMatchObject({
      skip: 20,
      take: 20,
      orderBy: [{ fecha_pago: "desc" }, { id_pago_cliente: "desc" }],
    });
    expect(count?.args).toEqual({ where: listArgs.where });
    expect(html).toContain("pagos");
    expect(html).toMatch(/P[áa]gina 2/);
  });
});
