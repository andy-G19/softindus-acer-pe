import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  characterizePage,
  generatedResult,
  isPrismaCall,
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

// C5 de la 11.4b (D50, hallazgo 8 de la 11.4a): el listado de movimientos ofrecia «Anular» en el
// ingreso de una venta de chatarra, que la accion rechaza desde la 11.4a (D45). Ahora la fila
// muestra la venta que lo genero en lugar del boton; los demas movimientos siguen ofreciendolo.

const loadPage = () => import("./page");

preloadPages(loadPage);

type Row = Record<string, unknown>;

const D = (value: string) => new Prisma.Decimal(value);

/** El fragmento de la fila que contiene el concepto. */
function rowOf(html: string | null, concept: string) {
  expect(html).not.toBeNull();

  const row = (html ?? "").split("<tr>").find((part) => part.includes(concept));

  expect(row, `no hay fila con «${concept}»`).toBeDefined();
  return row ?? "";
}

describe("C5 de la 11.4b: el ingreso de una venta no ofrece anular", () => {
  it("la fila de la venta nombra la venta y no tiene boton; la de un egreso si lo tiene", async () => {
    const movements = (args: PrismaArgs) => {
      const [first] = generatedResult("movimiento_caja", "findMany", args) as Row[];

      return [
        {
          ...first,
          id_movimiento_caja: "MCA00000021",
          tipo_movimiento: "ingreso",
          concepto: "Venta de chatarra CHA00000004",
          monto: D("80.25"),
          observaciones: null,
          venta_chatarra: [{ id_venta_chatarra: "VCH00000003" }],
        },
        {
          ...first,
          id_movimiento_caja: "MCA00000022",
          tipo_movimiento: "egreso",
          concepto: "Taxi a proveedor",
          monto: D("40.25"),
          observaciones: null,
          venta_chatarra: [],
        },
      ];
    };

    const { html, calls } = await characterizePage(
      loadPage,
      { name: "venta", data: { "movimiento_caja.findMany": movements } },
      "/dashboard/petty-cash/movements",
    );

    const saleRow = rowOf(html, "Venta de chatarra CHA00000004");
    const expenseRow = rowOf(html, "Taxi a proveedor");

    expect(saleRow).toContain("Venta VCH00000003");
    expect(saleRow).not.toContain(">Anular</button>");
    expect(expenseRow).toContain(">Anular</button>");

    // La consulta trae la venta de cada movimiento: sin ella la fila no podria saberlo.
    const list = calls.filter(isPrismaCall).find((call) => call.prisma === "movimiento_caja.findMany");

    expect(JSON.stringify(list?.args)).toContain('"venta_chatarra":{"select":{"id_venta_chatarra":true}');
  });
});
