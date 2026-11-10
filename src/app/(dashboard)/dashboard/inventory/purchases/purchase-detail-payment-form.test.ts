import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  characterizePage,
  generatedResult,
  generatedRow,
  preloadPages,
  type DataOverrides,
  type PrismaArgs,
} from "@/testing/page-characterization";

// Hallazgo 9 de la 11.2a (verificacion en staging): el detalle dejaba de renderizar el
// formulario de pago cuando la compra quedaba sin saldo, y el pago que la saldaba perdia su
// aviso (el componente desaparecia con su propio resultado). El detalle lo renderiza siempre
// y le dice con canPay si muestra el formulario. Un doble del formulario deja ver la prop: el
// HTML del formulario real oculto no se distingue de no renderizarlo.

vi.mock("server-only", () => ({}));
vi.mock("@/modules/inventory/supplier-payments/supplier-payment-form", () => ({
  SupplierPaymentForm: ({ canPay, saldoPendiente }: { canPay: boolean; saldoPendiente: string }) =>
    createElement("output", { "data-can-pay": String(canPay), "data-saldo": saldoPendiente }),
}));
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

const D = (value: string) => new Prisma.Decimal(value);
const loadDetail = () => import("./[id]/page");

function purchase(estado_compra: string, pagos: string[]): DataOverrides {
  return {
    "compra.findUnique": (args: PrismaArgs) => ({
      ...(generatedRow("compra", "findUnique", args) as Record<string, unknown>),
      monto_total: D("100.30"),
      estado_compra,
    }),
    "pago_proveedor.findMany": (args: PrismaArgs) => {
      const rows = generatedResult("pago_proveedor", "findMany", args) as Record<string, unknown>[];

      return pagos.map((monto, index) => ({ ...rows[index % rows.length], monto_pagado: D(monto) }));
    },
  };
}

async function paymentFormOf(data: DataOverrides) {
  const { html } = await characterizePage(
    loadDetail,
    { name: "detalle", params: { id: "COM00000010" }, data },
    "/dashboard/inventory/purchases/[id]",
  );

  if (html === null) {
    throw new Error("El detalle no se renderizo.");
  }

  return html.match(/<output data-can-pay="(\w+)" data-saldo="([^"]*)">\s*<\/output>/)?.slice(1) ?? null;
}

describe("hallazgo 9 de la 11.2a: el detalle siempre renderiza el pago", () => {
  preloadPages(loadDetail);

  it("con saldo, muestra el formulario", async () => {
    expect(await paymentFormOf(purchase("confirmada", ["50.10"]))).toEqual(["true", "50.20"]);
  });

  it("pagada, lo sigue renderizando sin formulario", async () => {
    expect(await paymentFormOf(purchase("confirmada", ["50.10", "50.20"]))).toEqual(["false", "0.00"]);
  });

  it("anulada, lo sigue renderizando sin formulario", async () => {
    expect(await paymentFormOf(purchase("anulada", []))).toEqual(["false", "100.30"]);
  });
});
