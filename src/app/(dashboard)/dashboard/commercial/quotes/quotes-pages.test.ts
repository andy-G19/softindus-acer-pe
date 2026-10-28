import { vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  definePageSuite,
  generatedResult,
  generatedRow,
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

// Caracterizacion de Proformas (entrega 4.2), escrita antes de mover sus
// consultas a modules/commercial/quotes/queries.ts.

// Proforma vigente sin pagos ni comprobantes: el caso en que se puede anular.
const annullableQuote = (args: Parameters<typeof generatedRow>[2]) => ({
  ...generatedRow("proforma", "findUnique", args),
  estado: "vigente",
  pago_cliente: [],
  comprobante_venta: [],
});

// Entrega 10.4b: lo que pasa hoy con las fechas y los estados antes de pasar
// la barra a FilterBar y DateRangeFields y el estado a Badge (detalle de las
// fechas en orders-pages.test.ts). Los datos generados dan a cada proforma
// pagos, comprobantes y un estado que no existe: la lista nunca mostraba un
// estado real, «Anular» ni «Sin comprobante», y siempre «Registrar pago».
const QUOTES_BY_STATUS = (args: PrismaArgs) => {
  const [base] = generatedResult("proforma", "findMany", args) as Record<string, unknown>[];

  return [
    // Anulable: vigente, con saldo, sin pagos ni comprobantes.
    {
      ...base,
      id_proforma: "PRF00000011",
      numero_proforma: "PRF-0011",
      estado: "vigente",
      pago_cliente: [],
      comprobante_venta: [],
    },
    { ...base, id_proforma: "PRF00000012", numero_proforma: "PRF-0012", estado: "aceptada" },
    {
      ...base,
      id_proforma: "PRF00000013",
      numero_proforma: "PRF-0013",
      estado: "pagada",
      saldo: new Prisma.Decimal("0"),
    },
    {
      ...base,
      id_proforma: "PRF00000014",
      numero_proforma: "PRF-0014",
      estado: "anulada",
      pago_cliente: [],
      comprobante_venta: [],
    },
  ];
};

// Detalle de una proforma pagada de un pedido aprobado, con su comprobante
// anulado: los tres estados que el detalle pinta, con valores reales.
const paidQuoteWithAnnulledReceipt = (args: PrismaArgs) => {
  const quote = generatedRow("proforma", "findUnique", args);
  const order = quote.pedido as Record<string, unknown>;
  const [receipt] = quote.comprobante_venta as Record<string, unknown>[];

  return {
    ...quote,
    estado: "pagada",
    saldo: new Prisma.Decimal("0"),
    pedido: { ...order, estado: "aprobado" },
    comprobante_venta: [{ ...receipt, estado: "anulado" }],
  };
};

definePageSuite([
  {
    route: "/dashboard/commercial/quotes",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros con saldo pendiente",
        searchParams: {
          q: "PRF",
          client: "CLI00000001",
          order: "PED00000001",
          status: "vigente",
          balance: "pending",
          from: "2026-07-01",
          to: "2026-07-31",
        },
      },
      { name: "saldo pagado", searchParams: { balance: "paid" } },
      {
        name: "rango invertido",
        searchParams: { from: "2026-07-31", to: "2026-07-01" },
        data: { "proforma.findMany": [] },
      },
      {
        name: "fechas no validas",
        searchParams: { from: "2026-02-30", to: "2026-07-32" },
      },
      { name: "una proforma por estado", data: { "proforma.findMany": QUOTES_BY_STATUS } },
    ],
  },
  {
    route: "/dashboard/commercial/quotes/new",
    load: () => import("./new/page"),
    cases: [
      { name: "formulario" },
      { name: "pedido preseleccionado", searchParams: { orderId: "id_pedido-1" } },
    ],
  },
  {
    route: "/dashboard/commercial/quotes/[id]",
    load: () => import("./[id]/page"),
    cases: [
      { name: "detalle", params: { id: "PRF00000001" } },
      {
        name: "anulable",
        params: { id: "PRF00000001" },
        data: { "proforma.findUnique": annullableQuote },
      },
      {
        name: "pagada con su comprobante anulado",
        params: { id: "PRF00000001" },
        data: { "proforma.findUnique": paidQuoteWithAnnulledReceipt },
      },
      {
        name: "inexistente",
        params: { id: "PRF99999999" },
        data: { "proforma.findUnique": null },
      },
    ],
  },
]);
