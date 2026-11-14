import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { registerOperatorPaymentAction } from "@/modules/staff/payment-history/actions";
import {
  characterizeHandler,
  describeNavigationError,
  isPrismaCall,
} from "@/testing/page-characterization";

// C2 de la 11.5 (D53): el pago se comparaba con el neto con una tolerancia de 0.01 en number, que
// dependia del error de coma flotante: sobre un neto de 30.10 se aceptaba y se guardaba un pago de
// 30.11, y sobre 90.00 uno de 90.009 se guardaba como 90.01 (hallazgo 2). Ahora el pago,
// redondeado como su columna, debe ser exactamente el neto en centesimos.

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
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audit", () => ({ registerAuditLog: async () => {} }));
vi.mock("@/lib/correlatives-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
  getNextCorrelativeId: async () => "HPO00000021",
}));

const MISMATCH = "Para esta versión MVP, el monto pagado debe coincidir con el monto neto de la planilla.";

/** Paga una planilla pendiente con ese neto: el resultado y el monto que se guarda. */
async function pay(neto: string, monto: string) {
  const formData = new FormData();

  for (const [key, value] of Object.entries({
    id_planilla: "PLA00000009",
    fecha_pago: "2026-11-09",
    monto_pagado: monto,
    metodo_pago: "efectivo",
    observaciones: "",
  })) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        await registerOperatorPaymentAction(formData);

        return "termino sin redirigir";
      } catch (error) {
        return describeNavigationError(error) ?? `error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
    {
      "planilla_pago.findUnique": {
        id_planilla: "PLA00000009",
        id_operario: "OPE00000003",
        periodo_inicio: new Date("2026-11-02T00:00:00.000Z"),
        periodo_fin: new Date("2026-11-08T00:00:00.000Z"),
        monto_neto: new Prisma.Decimal(neto),
        estado_pago: "pendiente",
        operario: { id_operario: "OPE00000003", nombres: "Luis", apellidos: "Quispe" },
        historial_pago_operario: [],
      },
    },
  );

  const create = calls.filter(isPrismaCall).find((call) => call.prisma === "historial_pago_operario.create");

  return {
    result,
    saved: (create?.args as { data: Record<string, unknown> } | undefined)?.data.monto_pagado,
  };
}

describe("C2 de la 11.5: el pago es exactamente el neto", () => {
  it.each([
    ["30.10", "30.11"],
    ["90.00", "90.009"],
    ["90.00", "89.99"],
  ])("sobre un neto de %s, un pago de %s se rechaza sin escribir", async (neto, monto) => {
    expect(await pay(neto, monto)).toEqual({ result: `error: ${MISMATCH}`, saved: undefined });
  });

  it.each([
    ["90.00", "90", "90.00"],
    // 90.004 se guardaria como 90.00: es el neto.
    ["90.00", "90.004", "90.00"],
    ["30.10", "30.1", "30.10"],
  ])("sobre un neto de %s, un pago de %s se acepta y se guarda %s", async (neto, monto, saved) => {
    expect(await pay(neto, monto)).toEqual({
      result: "redirect:/dashboard/staff/payment-history?toast=operator-payment-registered",
      saved,
    });
  });
});
