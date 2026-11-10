import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  definePageSuite,
  isPrismaCall,
  type DataOverrides,
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

// Caracterizacion de Pagos a proveedores (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/supplier-payments/queries.ts.
//
// Entrega 10.3c: lo que pasa hoy con las fechas antes de pasar la barra a
// FilterBar y DateRangeFields (detalle en entries-pages.test.ts). Con el
// rango invertido la base no devuelve filas: el caso deja la lista vacia.
const EMPTY_LIST: DataOverrides = {
  "pago_proveedor.findMany": [],
  "pago_proveedor.count": 0,
};

definePageSuite([
  {
    route: "/dashboard/inventory/supplier-payments",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "F001",
          supplier: "PRV00000001",
          purchase: "COM00000001",
          method: "transferencia",
          status: "pagado",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      {
        name: "rango invertido",
        searchParams: { from: "2026-07-31", to: "2026-07-01" },
        data: EMPTY_LIST,
      },
      {
        name: "fechas no validas",
        searchParams: { from: "2026-02-30", to: "2026-07-32" },
      },
    ],
  },
]);

// C6 de la 11.2a (hallazgo 5 de la 10.3c): la lista cargaba todos los pagos de una vez.
// Ahora pagina como Compras: 20 por pagina, con el total contado aparte y un orden
// completo (fecha y luego id), para que una fila no salte de pagina entre dos consultas.
describe("C6 de la 11.2a: pagos a proveedores paginados", () => {
  it("la segunda pagina pide los pagos 21 a 40 y cuenta el total con el mismo filtro", async () => {
    const { calls, html } = await characterizePage(
      () => import("./page"),
      { name: "segunda pagina", searchParams: { page: "2", status: "pagado" } },
      "/dashboard/inventory/supplier-payments",
    );

    const prismaCalls = calls.filter(isPrismaCall);
    const list = prismaCalls.find((call) => call.prisma === "pago_proveedor.findMany");
    const count = prismaCalls.find((call) => call.prisma === "pago_proveedor.count");
    const listArgs = list?.args as { where?: unknown; skip?: number; take?: number; orderBy?: unknown };

    expect(listArgs).toMatchObject({
      skip: 20,
      take: 20,
      orderBy: [{ fecha_pago: "desc" }, { id_pago_proveedor: "desc" }],
    });
    expect(count?.args).toEqual({ where: listArgs.where });
    expect(html).toContain("pagos");
    expect(html).toMatch(/P[áa]gina 2/);
  });
});
