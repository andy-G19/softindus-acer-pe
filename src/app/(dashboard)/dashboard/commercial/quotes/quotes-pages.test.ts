import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  characterizePage,
  definePageSuite,
  generatedResult,
  generatedRow,
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
        data: { "proforma.findMany": [], "proforma.count": 0 },
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
      {
        name: "desde el listado filtrado: vuelve a el",
        searchParams: { returnTo: "/dashboard/commercial/quotes?status=vigente" },
      },
      { name: "un returnTo externo se ignora", searchParams: { returnTo: "https://example.com/quotes" } },
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
        // C5 de la 11.3a: el pago trata un saldo cero como pagado aunque el estado no lo diga, y
        // la seccion de pago lo muestra igual (deshabilitada).
        name: "aceptada con saldo cero: no admite pagos",
        params: { id: "PRF00000001" },
        data: {
          "proforma.findUnique": (args: PrismaArgs) => ({
            ...annullableQuote(args),
            estado: "aceptada",
            saldo: new Prisma.Decimal("0"),
          }),
        },
      },
      {
        name: "inexistente",
        params: { id: "PRF99999999" },
        data: { "proforma.findUnique": null },
      },
    ],
  },
]);

// C4 de la 11.3c (D38, hallazgo 9 de la 10.4a): la lista cargaba todas las filas de una vez. Ahora
// pagina como pagos a proveedores: 20 por pagina, con el total contado aparte con el mismo filtro y
// un orden completo (fecha y luego id), porque la fecha es un dia y las filas del mismo dia
// empatan.
describe("C4 de la 11.3c: proformas paginados", () => {
  it("la segunda pagina pide las filas 21 a 40 y cuenta el total con el mismo filtro", async () => {
    const { calls, html } = await characterizePage(
      () => import("./page"),
      { name: "segunda pagina", searchParams: { page: "2", status: "vigente" } },
      "/dashboard/commercial/quotes",
    );

    const prismaCalls = calls.filter(isPrismaCall);
    const list = prismaCalls.find((call) => call.prisma === "proforma.findMany");
    const count = prismaCalls.find((call) => call.prisma === "proforma.count");
    const listArgs = list?.args as { where?: unknown; skip?: number; take?: number; orderBy?: unknown };

    expect(listArgs).toMatchObject({
      skip: 20,
      take: 20,
      orderBy: [{ fecha_emision: "desc" }, { id_proforma: "desc" }],
    });
    expect(count?.args).toEqual({ where: listArgs.where });
    expect(html).toContain("proformas");
    expect(html).toMatch(/P[áa]gina 2/);
  });
});

// C2 del grupo de fixes (D124 y D125, hallazgo 5 de la 11.3c): la tarjeta del cliente del detalle
// mostraba el tipo de cliente y el tipo de documento como se guardan («ferreteria», «ruc»).
describe("C2 del grupo de fixes: el cliente del detalle con sus textos", () => {
  it("muestra el texto del tipo de cliente y del tipo de documento", async () => {
    const { html } = await characterizePage(
      () => import("./[id]/page"),
      {
        name: "detalle con cliente",
        params: { id: "PRF00000001" },
        data: {
          "proforma.findUnique": (args) => {
            const row = generatedRow("proforma", "findUnique", args) as {
              pedido: { cliente: Record<string, unknown> };
            };

            row.pedido.cliente.tipo_cliente = "ferreteria";
            row.pedido.cliente.tipo_documento = "ruc";
            row.pedido.cliente.numero_documento = "20123456789";

            return row;
          },
        },
      },
      "/dashboard/commercial/quotes/[id]",
    );

    expect(html).toMatch(/Tipo:<\/span>(?:<!-- -->|\s)*Ferretería</);
    expect(html).toMatch(/Documento:<\/span>(?:<!-- -->|\s)*RUC(?:<!-- -->|\s)*20123456789/);
  });
});

// C3 de la 11.7d (D108, hallazgo 7 de la 11.3c): los historiales del detalle ordenaban solo por un
// dia (`@db.Date`), y dos pagos o comprobantes del mismo dia salian en un orden arbitrario (en
// staging, el adelanto y la cancelacion de PF-00000004, el mas antiguo primero). Desempatan por id,
// en el mismo sentido que la fecha, como los listados de la 11.3c.
describe("C3 de la 11.7d: los historiales del detalle desempatan por id", () => {
  it("pagos y comprobantes ordenan por fecha y luego por id, los dos descendentes", async () => {
    const { calls } = await characterizePage(
      () => import("./[id]/page"),
      { name: "detalle con historiales", params: { id: "PRF00000001" } },
      "/dashboard/commercial/quotes/[id]",
    );

    const detail = calls.filter(isPrismaCall).find((call) => call.prisma === "proforma.findUnique");
    const include = (detail?.args as { include?: Record<string, { orderBy?: unknown }> }).include;

    expect(include?.pago_cliente?.orderBy).toEqual([{ fecha_pago: "desc" }, { id_pago_cliente: "desc" }]);
    expect(include?.comprobante_venta?.orderBy).toEqual([
      { fecha_emision: "desc" },
      { id_comprobante: "desc" },
    ]);
  });
});
