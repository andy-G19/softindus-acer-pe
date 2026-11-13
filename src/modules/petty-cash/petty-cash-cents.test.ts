import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createPettyCashExpenseAction } from "@/modules/petty-cash/expenses/actions";
import { createPettyCashIncomeAdjustmentAction } from "@/modules/petty-cash/income-adjustments/actions";
import {
  characterizeHandler,
  describeNavigationError,
  isPrismaCall,
  type DataOverrides,
} from "@/testing/page-characterization";

// C2 de la 11.4a (D43, hallazgo 3 de la auditoria de la 11.4): egresos, ingresos y ajustes de caja
// chica en centimos.
//
// Las columnas `movimiento_caja.monto` y `caja_chica.saldo_actual` son numeric(12, 2). La accion
// mandaba el monto escrito tal cual: la columna del movimiento lo redondeaba por su cuenta y el
// saldo redondeaba la resta, que no es lo mismo. Con un egreso de 40.005 sobre 100.00 el
// movimiento guardaba 40.01 y el saldo quedaba en 60.00 (100.00 - 40.005 = 59.995): la suma de
// los movimientos dejaba de cuadrar con el saldo. Un monto de 0.004 se guardaba como un
// movimiento de 0.00, y un egreso de 100.004 se rechazaba por superar un saldo de 100.00 aunque
// se habria guardado como 100.00. Ahora el monto se redondea a dos decimales antes de comparar y
// de escribir, y lo que se manda es lo que se guarda.

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
  getNextCorrelativeId: async () => "MCA00000001",
}));

const D = (value: string) => new Prisma.Decimal(value);

const BOX = {
  id_caja_chica: "CAJ00000002",
  nombre_caja: "Caja taller",
  saldo_actual: D("100.00"),
  estado: "abierta",
};

const DATA: DataOverrides = {
  "caja_chica.findUnique": BOX,
  "categoria_gasto.findUnique": { id_categoria_gasto: "CGA00000003", nombre_categoria: "Movilidad", estado: true },
};

type Action = (formData: FormData) => Promise<unknown>;

async function run(action: Action, fields: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        const state = (await action(formData)) as
          | { status?: string; error?: string; fieldErrors?: Record<string, string[] | undefined> }
          | undefined;

        // C5 de la 11.4a: el egreso devuelve el estado del formulario en lugar de redirigir; un
        // error del monto queda en su campo.
        if (state?.status === "success") {
          return "guardado";
        }

        if (state?.status === "error") {
          return `error: ${state.fieldErrors?.monto?.[0] ?? state.error}`;
        }

        return "termino sin redirigir";
      } catch (error) {
        return describeNavigationError(error) ?? `error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
    DATA,
    { role: "ADMIN" },
  );
  const prismaCalls = calls.filter(isPrismaCall);
  const created = prismaCalls.find((call) => call.prisma === "movimiento_caja.create")?.args as
    | { data: { monto: unknown } }
    | undefined;
  const balance = prismaCalls.find((call) => call.prisma === "caja_chica.update")?.args as
    | { data: { saldo_actual: Record<string, unknown> } }
    | undefined;

  return {
    outcome: result,
    monto: created === undefined ? undefined : String(created.data.monto),
    saldo: balance === undefined ? undefined : balance.data.saldo_actual,
  };
}

const expense = (monto: string) =>
  run((formData) => createPettyCashExpenseAction({ status: "idle" }, formData), {
    clave_operacion: "5f0c2b7e-8d41-4c3a-9b6e-1a2b3c4d5e6f",
    id_caja_chica: "CAJ00000002",
    id_categoria_gasto: "CGA00000003",
    concepto: "Taxi a proveedor",
    monto,
    fecha_movimiento: "2026-11-10",
    comprobante: "",
    responsable: "",
    observaciones: "",
  });

const income = (tipo_operacion: string, monto: string) =>
  run((formData) => createPettyCashIncomeAdjustmentAction({ status: "idle" }, formData), {
    clave_operacion: "7a1d3c5e-2b4f-4e6a-8c9d-0e1f2a3b4c5d",
    id_caja_chica: "CAJ00000002",
    tipo_operacion,
    concepto: "Arqueo de caja",
    monto,
    fecha_movimiento: "2026-11-10",
    comprobante: "",
    responsable: "",
    observaciones: "",
  });

describe("C2 de la 11.4a: egreso en centimos", () => {
  it("un monto que la columna guardaria como 0.00 no es un egreso", async () => {
    const { outcome, monto } = await expense("0.004");

    expect(outcome).toBe("error: El monto debe ser mayor a cero.");
    expect(monto).toBeUndefined();
  });

  it("el movimiento y el descuento del saldo usan el mismo monto redondeado", async () => {
    const { outcome, monto, saldo } = await expense("40.005");

    expect(outcome).toBe("guardado");
    expect(monto).toBe("40.01");
    expect(saldo).toEqual({ decrement: "40.01" });
  });

  it("un egreso que se guarda como todo el saldo se acepta", async () => {
    const { outcome, monto, saldo } = await expense("100.004");

    expect(outcome).toBe("guardado");
    expect(monto).toBe("100.00");
    expect(saldo).toEqual({ decrement: "100.00" });
  });

  it("un egreso que se guarda por encima del saldo se rechaza", async () => {
    const { outcome } = await expense("100.005");

    expect(outcome).toBe("error: El egreso supera el saldo disponible de la caja. Saldo actual: S/ 100.00.");
  });
});

describe("C2 de la 11.4a: ingreso y ajuste en centimos", () => {
  it("un ingreso que la columna guardaria como 0.00 se rechaza", async () => {
    const { outcome, monto } = await income("ingreso", "0.004");

    expect(outcome).toBe("error: El monto debe ser mayor a cero.");
    expect(monto).toBeUndefined();
  });

  it("el ingreso y el aumento del saldo usan el mismo monto redondeado", async () => {
    const { monto, saldo } = await income("ingreso", "60.505");

    expect(monto).toBe("60.51");
    expect(saldo).toEqual({ increment: "60.51" });
  });

  it("un ajuste negativo que se guarda como todo el saldo se acepta", async () => {
    const { outcome, monto, saldo } = await income("ajuste_disminucion", "100.004");

    expect(outcome).toBe("guardado");
    expect(monto).toBe("100.00");
    expect(saldo).toEqual({ decrement: "100.00" });
  });
});
