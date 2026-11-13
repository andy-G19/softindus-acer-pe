import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createScrapSaleAction } from "@/modules/waste-scrap/scrap-sales/actions";
import {
  characterizeHandler,
  describeNavigationError,
  isPrismaCall,
  type DataOverrides,
} from "@/testing/page-characterization";

// C2 de la 11.4b (D48): la venta de chatarra en centimos, como el egreso de caja chica (C2 de la
// 11.4a).
//
// `venta_chatarra.monto_recibido`, `movimiento_caja.monto` y `caja_chica.saldo_actual` son
// numeric(12, 2); `peso_vendido_kg` y `cantidad_vendida`, numeric(10, 2). La accion mandaba el monto
// escrito y cada columna lo redondeaba por su cuenta. En una suma los dos redondeos coinciden, pero
// lo que se manda no es lo que se guarda, y un monto de 0.004 se guardaba como una venta de 0.00. El
// peso y la cantidad se comparaban con number: 15.004 kg sobre 15.00 se rechazaba aunque se guarde
// como 15.00. Ahora se redondean antes de comparar y de escribir, y lo que se manda es lo que se
// guarda, la regla de caja chica (petty-cash-amounts.ts).

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock({
    transactions: true,
    recordTransactionEnd: true,
  }),
);
vi.mock("@/lib/authz", async () =>
  (await import("@/testing/page-characterization")).authzModuleMock(),
);
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("@/lib/audit", () => ({ registerAuditLog: async () => undefined }));
vi.mock("@/lib/correlatives-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
  getNextCorrelativeId: async (_tx: unknown, params: { prefijo: string }) => `${params.prefijo}00000001`,
}));

const D = (value: string) => new Prisma.Decimal(value);

const DATA: DataOverrides = {
  "chatarra.findUnique": {
    id_chatarra: "CHA00000004",
    tipo_material: "Retazos de plancha",
    peso_kg: D("15.00"),
    cantidad: D("3.00"),
    estado: "acumulada",
    venta_chatarra: [],
  },
  "caja_chica.findUnique": { id_caja_chica: "CAJ00000002", estado: "abierta" },
};

async function sell(changes: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({
    id_chatarra: "CHA00000004",
    id_caja_chica: "CAJ00000002",
    fecha_venta: "2026-11-10",
    cantidad_vendida: "",
    peso_vendido_kg: "12.50",
    monto_recibido: "80.25",
    destino_dinero: "",
    observaciones: "",
    ...changes,
  })) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        await createScrapSaleAction(formData);

        return "termino sin redirigir";
      } catch (error) {
        return describeNavigationError(error) ?? `error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
    DATA,
    { role: "ADMIN" },
  );
  const prismaCalls = calls.filter(isPrismaCall);
  const argsOf = (name: string) =>
    prismaCalls.find((call) => call.prisma === name)?.args as { data: Record<string, unknown> } | undefined;
  const sale = argsOf("venta_chatarra.create")?.data;

  return {
    outcome: result,
    venta: sale && {
      monto_recibido: String(sale.monto_recibido),
      peso_vendido_kg: String(sale.peso_vendido_kg),
      cantidad_vendida: String(sale.cantidad_vendida),
    },
    movimiento: argsOf("movimiento_caja.create")?.data.monto,
    saldo: argsOf("caja_chica.update")?.data.saldo_actual,
  };
}

const SAVED = "redirect:/dashboard/waste-scrap/scraps?toast=scrap-sale-created";

describe("C2 de la 11.4b: venta de chatarra en centimos", () => {
  it("un monto que la columna guardaria como 0.00 no es una venta", async () => {
    const { outcome, venta } = await sell({ monto_recibido: "0.004" });

    expect(outcome).toBe("error: El monto recibido debe ser mayor que cero.");
    expect(venta).toBeUndefined();
  });

  it("la venta, el movimiento y el aumento del saldo usan el mismo monto redondeado", async () => {
    const { outcome, venta, movimiento, saldo } = await sell({ monto_recibido: "80.005" });

    expect(outcome).toBe(SAVED);
    expect(venta?.monto_recibido).toBe("80.01");
    expect(movimiento).toBe("80.01");
    expect(saldo).toEqual({ increment: "80.01" });
  });

  it("un peso que se guarda como el registrado se acepta, y se guarda redondeado", async () => {
    const { outcome, venta } = await sell({ peso_vendido_kg: "15.004" });

    expect(outcome).toBe(SAVED);
    expect(venta?.peso_vendido_kg).toBe("15.00");
  });

  it("un peso que se guarda por encima del registrado se rechaza", async () => {
    const { outcome } = await sell({ peso_vendido_kg: "15.005" });

    expect(outcome).toBe("error: El peso vendido no puede superar el peso registrado.");
  });

  it("una cantidad que se guarda como la registrada se acepta, y se guarda redondeada", async () => {
    const { outcome, venta } = await sell({ cantidad_vendida: "3.004" });

    expect(outcome).toBe(SAVED);
    expect(venta?.cantidad_vendida).toBe("3.00");
  });
});
