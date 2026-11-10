import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  characterizePage,
  definePageSuite,
  generatedResult,
  generatedRow,
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

// Caracterizacion de Compras (entrega 4.3), escrita antes
// de mover sus consultas a modules/inventory/purchases/queries.ts.
//
// Entrega 10.3c: lo que pasa hoy con las fechas antes de pasar la barra a
// FilterBar y DateRangeFields (detalle en entries-pages.test.ts). Con el
// rango invertido la base no devuelve filas: el caso deja la lista vacia.
//
// Los datos generados dan dos pagos a cada compra, asi que la lista nunca
// mostraba «Anular» ni el detalle «Anular compra» y «Registrar pago»: los
// casos con una compra sin pagos fijan esas acciones antes de tocar las
// paginas.
const EMPTY_LIST: DataOverrides = {
  "compra.findMany": [],
  "compra.count": 0,
};

const WITH_ANNULLABLE_PURCHASE: DataOverrides = {
  "compra.findMany": (args: PrismaArgs) => {
    const [first, ...rest] = generatedResult("compra", "findMany", args) as Record<string, unknown>[];

    return [
      { ...first, estado_compra: "registrada", estado_pago: "pendiente", pago_proveedor: [] },
      ...rest,
    ];
  },
};

const PENDING_PURCHASE: DataOverrides = {
  "compra.findUnique": (args: PrismaArgs) => ({
    ...generatedRow("compra", "findUnique", args),
    estado_compra: "registrada",
    estado_pago: "pendiente",
  }),
  "pago_proveedor.findMany": [],
};

definePageSuite([
  {
    route: "/dashboard/inventory/purchases",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "F001",
          supplier: "PRV00000001",
          material: "MAT00000001",
          status: "confirmada",
          payment: "pendiente",
          from: "2026-07-01",
          to: "2026-07-31",
          page: "2",
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
      { name: "con una compra anulable", data: WITH_ANNULLABLE_PURCHASE },
    ],
  },
  {
    route: "/dashboard/inventory/purchases/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
    ],
  },
  {
    route: "/dashboard/inventory/purchases/[id]",
    load: () => import("./[id]/page"),
    cases: [
      {
        name: "detalle con regreso al listado",
        params: { id: "COM00000001" },
        searchParams: { returnTo: "/dashboard/inventory/purchases?payment=pendiente" },
      },
      {
        name: "pendiente y sin pagos",
        params: { id: "COM00000001" },
        data: PENDING_PURCHASE,
      },
      {
        name: "inexistente redirige al listado",
        params: { id: "COM99999999" },
        data: { "compra.findUnique": null },
      },
    ],
  },
]);

// Hallazgo 2 de la 11.2a: el detalle restaba los pagos con number. Una compra
// de 10.07 pagada con 10.04 y 0.03 daba un saldo de 1.8e-15, mayor que cero,
// y seguia ofreciendo «Registrar pago» con un saldo de S/ 0.00.
describe("hallazgo 2 de la 11.2a: el saldo del detalle con decimales", () => {
  const D = (value: string) => new Prisma.Decimal(value);

  it("no ofrece registrar pago a una compra pagada por completo", async () => {
    const { html } = await characterizePage(
      () => import("./[id]/page"),
      {
        name: "pagada con decimales",
        params: { id: "COM00000001" },
        data: {
          "compra.findUnique": (args: PrismaArgs) => ({
            ...generatedRow("compra", "findUnique", args),
            monto_total: D("10.07"),
            estado_compra: "confirmada",
            estado_pago: "pagado",
          }),
          "pago_proveedor.findMany": (args: PrismaArgs) => {
            const [first, second] = generatedResult("pago_proveedor", "findMany", args) as Record<
              string,
              unknown
            >[];

            return [
              { ...first, monto_pagado: D("10.04") },
              { ...second, monto_pagado: D("0.03") },
            ];
          },
        },
      },
      "/dashboard/inventory/purchases/[id]",
    );

    expect(html).toContain("S/ 0.00");
    expect(html).not.toContain("Registrar pago");
  });
});
