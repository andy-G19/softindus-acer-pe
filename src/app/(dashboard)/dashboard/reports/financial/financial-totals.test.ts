import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { exportFinancialReport } from "@/modules/reports/financial/exporter";
import {
  characterizeHandler,
  characterizePage,
  generatedResult,
  preloadPages,
  type DataOverrides,
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

// C7 de la 11.4b (D52): los totales de caja chica y de compras por pagar del reporte financiero se
// sumaban sobre las filas cargadas, como maximo 100 en la pagina y el limite en la exportacion.
// Con mas filas que esas, los totales quedaban cortos. Ahora salen de todas las filas que cumplen
// el filtro, con la misma funcion en la pagina y en la exportacion; las tablas siguen mostrando
// las primeras filas. La definicion no cambia: solo cuentan los tipos «ingreso» y «egreso».

const loadPage = () => import("./page");

preloadPages(loadPage);

type Row = Record<string, unknown>;

const D = (value: string) => new Prisma.Decimal(value);

/** Las primeras filas, las que muestra la tabla: un ingreso de 10.00 y un egreso de 4.00. */
function loadedMovements(args: PrismaArgs) {
  const [first] = generatedResult("movimiento_caja", "findMany", args) as Row[];

  return [
    { ...first, id_movimiento_caja: "MCA00000101", tipo_movimiento: "ingreso", monto: D("10.00") },
    { ...first, id_movimiento_caja: "MCA00000102", tipo_movimiento: "egreso", monto: D("4.00") },
  ];
}

/** Las sumas de todas las filas del filtro, por tipo. */
function movementSums(args: PrismaArgs) {
  const conditions = ((args?.where as { AND?: Row[] } | undefined)?.AND ?? []).map(
    (condition) => condition.tipo_movimiento,
  );
  const sums: Record<string, Prisma.Decimal> = { ingreso: D("1000.50"), egreso: D("400.25") };
  const type = conditions.find((value) => typeof value === "string");

  return { _sum: { monto: typeof type === "string" ? (sums[type] ?? null) : null } };
}

/**
 * Compras pendientes. Con `take` son las filas que se muestran (una); sin `take`, todas las del
 * filtro (tres): 100.30 con 50.10 pagado deja 50.20 (con number, 50.199999999999996), 200.00 sin
 * pagos y 10.00 con 20.00 pagado, que no resta.
 */
function pendingPurchases(args: PrismaArgs) {
  const [first] = generatedResult("compra", "findMany", args) as Row[];
  const purchase = (id: string, total: string, payments: string[]) => ({
    ...first,
    id_compra: id,
    monto_total: D(total),
    pago_proveedor: payments.map((amount) => ({ monto_pagado: D(amount) })),
  });

  if (typeof args?.take === "number") {
    return [purchase("COM00000101", "100.30", ["50.10"])];
  }

  return [
    purchase("COM00000101", "100.30", ["50.10"]),
    purchase("COM00000102", "200.00", []),
    purchase("COM00000103", "10.00", ["20.00"]),
  ];
}

const DATA: DataOverrides = {
  "movimiento_caja.findMany": loadedMovements,
  "movimiento_caja.aggregate": movementSums,
  "compra.findMany": pendingPurchases,
};

/** El valor de la tarjeta con ese titulo. */
function kpi(html: string | null, title: string) {
  expect(html).not.toBeNull();

  const page = html ?? "";
  const start = page.indexOf(`>${title}<`);

  expect(start, `no hay tarjeta «${title}»`).toBeGreaterThanOrEqual(0);
  return /S\/ -?\d+\.\d{2}/.exec(page.slice(start))?.[0];
}

describe("C7 de la 11.4b: totales del reporte financiero sobre todas las filas", () => {
  it("la pagina suma todos los movimientos y todas las compras pendientes, no las cargadas", async () => {
    const { html } = await characterizePage(
      loadPage,
      { name: "totales", data: DATA },
      "/dashboard/reports/financial",
    );

    expect(kpi(html, "Ingresos caja chica")).toBe("S/ 1000.50");
    expect(kpi(html, "Egresos caja chica")).toBe("S/ 400.25");
    expect(kpi(html, "Movimiento neto")).toBe("S/ 600.25");
    expect(kpi(html, "Compras por pagar")).toBe("S/ 250.20");
    expect(html).toContain("Compras pendientes o parciales: 3.");
  });

  it("la exportacion da los mismos totales y sigue exportando las filas cargadas", async () => {
    const { result } = await characterizeHandler(
      () => exportFinancialReport(new URLSearchParams(), 5000),
      DATA,
    );

    const summary = (indicator: string) => result.rows.find((row) => row[1] === indicator)?.[3];

    expect(summary("Ingresos caja chica")).toBe("S/ 1000.50");
    expect(summary("Egresos caja chica")).toBe("S/ 400.25");
    expect(summary("Movimiento neto caja")).toBe("S/ 600.25");
    expect(summary("Compras por pagar")).toBe("S/ 250.20");

    const movementRows = result.rows.filter((row) => row[0] === "Movimiento caja").map((row) => row[1]);

    expect(movementRows).toEqual(["MCA00000101", "MCA00000102"]);
  });
});
