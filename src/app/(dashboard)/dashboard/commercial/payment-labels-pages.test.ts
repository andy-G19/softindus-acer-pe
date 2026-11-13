import { describe, expect, it, vi } from "vitest";

import {
  characterizePage,
  generatedResult,
  generatedRow,
  preloadPages,
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

// C2 de la 11.3c (hallazgo 4 de la 10.4b, D36 y D37): las tablas de Comercial mostraban el tipo y
// el metodo de pago, y el tipo de comprobante, como se guardan («amortizacion», «boleta»), y los
// filtros con su texto («Amortización», «Boleta»). Ahora muestran el texto de payment-labels.ts;
// un valor que la lista no conoce (un dato antiguo) se muestra tal cual.

type Row = Record<string, unknown>;

const loadPayments = () => import("./payments/page");
const loadReceipts = () => import("./receipts/page");
const loadQuotes = () => import("./quotes/page");
const loadQuoteDetail = () => import("./quotes/[id]/page");

// La primera importacion de una pagina supera el plazo de 5 s con la suite completa: se importan
// antes, como en order-change-rule.test.ts.
preloadPages(loadPayments, loadReceipts, loadQuotes, loadQuoteDetail);

/**
 * Textos de las celdas `<td>` sin elementos dentro, en orden. El HTML es `null` si la pagina
 * redirige o falla: entonces la prueba falla aqui, no con una lista vacia que pareceria valida.
 */
function cellTexts(html: string | null) {
  expect(html).not.toBeNull();

  return [...(html ?? "").matchAll(/<td>([^<]*)<\/td>/g)].map((match) => match[1]);
}

describe("C2 de la 11.3c: Comercial muestra el texto de tipo y metodo", () => {
  it("pagos de cliente: tipo y metodo con su texto, y un valor antiguo tal cual", async () => {
    const payments = (args: PrismaArgs) => {
      const [first] = generatedResult("pago_cliente", "findMany", args) as Row[];

      return [
        { ...first, id_pago_cliente: "PCL00000021", tipo_pago: "amortizacion", metodo_pago: "transferencia" },
        { ...first, id_pago_cliente: "PCL00000022", tipo_pago: "cancelacion", metodo_pago: "efectivo" },
        { ...first, id_pago_cliente: "PCL00000023", tipo_pago: "saldo_viejo", metodo_pago: "deposito" },
      ];
    };

    const { html } = await characterizePage(
      loadPayments,
      { name: "textos", data: { "pago_cliente.findMany": payments } },
      "/dashboard/commercial/payments",
    );
    const cells = cellTexts(html);

    expect(cells).toEqual(expect.arrayContaining(["Amortización", "Transferencia", "Cancelación", "Efectivo"]));
    expect(cells).toEqual(expect.arrayContaining(["saldo_viejo", "deposito"]));
    expect(cells).not.toContain("amortizacion");
    expect(cells).not.toContain("transferencia");
    expect(cells).not.toContain("cancelacion");
    expect(cells).not.toContain("efectivo");
  });

  it("pagos de cliente: la opcion vacia de los filtros dice «Todos los …», como los demas", async () => {
    const { html } = await characterizePage(
      loadPayments,
      { name: "filtros" },
      "/dashboard/commercial/payments",
    );

    expect(html).toContain('<option value="" selected="">Todos los métodos</option>');
    expect(html).toContain('<option value="" selected="">Todos los tipos</option>');
    expect(html).not.toContain('<option value="" selected="">Método</option>');
    expect(html).not.toContain('<option value="" selected="">Tipo pago</option>');
  });

  it("comprobantes: el tipo con su texto, y un valor antiguo tal cual", async () => {
    const receipts = (args: PrismaArgs) => {
      const [first] = generatedResult("comprobante_venta", "findMany", args) as Row[];

      return [
        { ...first, id_comprobante: "CVE00000021", tipo_comprobante: "boleta", estado: "emitido" },
        { ...first, id_comprobante: "CVE00000022", tipo_comprobante: "factura", estado: "emitido" },
        { ...first, id_comprobante: "CVE00000023", tipo_comprobante: "nota", estado: "emitido" },
      ];
    };

    const { html } = await characterizePage(
      loadReceipts,
      { name: "textos", data: { "comprobante_venta.findMany": receipts } },
      "/dashboard/commercial/receipts",
    );
    const cells = cellTexts(html);

    expect(cells).toEqual(expect.arrayContaining(["Boleta", "Factura", "nota"]));
    expect(cells).not.toContain("boleta");
    expect(cells).not.toContain("factura");
  });

  it("proformas: la insignia del comprobante nombra su tipo con el texto", async () => {
    const quotes = (args: PrismaArgs) => {
      const [first] = generatedResult("proforma", "findMany", args) as Row[];

      return [
        {
          ...first,
          estado: "pagada",
          comprobante_venta: [
            { id_comprobante: "CVE00000031", numero_comprobante: "F001-0031", tipo_comprobante: "factura" },
          ],
        },
      ];
    };

    const { html } = await characterizePage(
      loadQuotes,
      { name: "insignia", data: { "proforma.findMany": quotes } },
      "/dashboard/commercial/quotes",
    );

    expect(html).toContain('<span data-variant="success">Factura F001-0031</span>');
    expect(html).not.toContain("factura F001-0031");
  });

  it("detalle de proforma: los historiales de pagos y comprobantes con su texto", async () => {
    const quote = (args: PrismaArgs) => {
      const row = generatedRow("proforma", "findUnique", args);
      const [payment] = row.pago_cliente as Row[];
      const [receipt] = row.comprobante_venta as Row[];

      return {
        ...row,
        estado: "pagada",
        pago_cliente: [
          { ...payment, id_pago_cliente: "PCL00000041", tipo_pago: "adelanto", metodo_pago: "yape" },
          { ...payment, id_pago_cliente: "PCL00000042", tipo_pago: "amortizacion", metodo_pago: "plin" },
        ],
        comprobante_venta: [
          { ...receipt, id_comprobante: "CVE00000041", tipo_comprobante: "recibo", estado: "anulado" },
          { ...receipt, id_comprobante: "CVE00000042", tipo_comprobante: "boleta", estado: "emitido" },
        ],
      };
    };

    const { html } = await characterizePage(
      loadQuoteDetail,
      { name: "historiales", params: { id: "PRF00000001" }, data: { "proforma.findUnique": quote } },
      "/dashboard/commercial/quotes/PRF00000001",
    );
    const cells = cellTexts(html);

    expect(cells).toEqual(expect.arrayContaining(["Adelanto", "Yape", "Amortización", "Plin", "Recibo", "Boleta"]));
    for (const stored of ["adelanto", "yape", "amortizacion", "plin", "recibo", "boleta"]) {
      expect(cells).not.toContain(stored);
    }
  });
});
