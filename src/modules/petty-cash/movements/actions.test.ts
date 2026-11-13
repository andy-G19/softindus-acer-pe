import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { annulPettyCashMovementAction } from "@/modules/petty-cash/movements/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion de anular un movimiento de caja chica (C1 de la 11.4a), escrita antes de tocar
// la accion: hasta aqui no tenia ninguna prueba.
//
// Fija la lectura del movimiento con su caja dentro de la transaccion (hoy sin bloquear ninguna
// de las dos filas), la marca «[ANULADO]» con el monto original y el monto en 0, la reversion
// atomica del saldo (un egreso o un ajuste negativo devuelven el monto; un ingreso o un ajuste
// positivo lo descuentan), la bitacora, las revalidaciones y el resultado. La fecha de la marca
// sale del reloj fijo del arnes.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

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
vi.mock("next/cache", async () => {
  const { recordEffect } = await import("@/testing/page-characterization");

  return {
    revalidatePath: (path: string) => recordEffect("revalidatePath", path),
  };
});
vi.mock("@/lib/audit", async () => {
  const { recordEffect } = await import("@/testing/page-characterization");

  return {
    registerAuditLog: async ({ tx, ...data }: Record<string, unknown>) => {
      recordEffect("registerAuditLog", { ...data, enTransaccion: tx !== undefined });
    },
  };
});
vi.mock("@/lib/correlatives-core", async (importOriginal) => {
  const { recordEffect } = await import("@/testing/page-characterization");
  const { formatCorrelativeId } = await import("@/lib/correlatives-format");

  return {
    ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
    getNextCorrelativeId: async (_tx: unknown, params: { codigoEntidad: string; prefijo: string }) => {
      recordEffect("getNextCorrelativeId", params);

      const next = (mocks.correlatives.get(params.prefijo) ?? 0) + 1;

      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
  };
});

expect.addSnapshotSerializer(decimalSnapshotSerializer);

const D = (value: string) => new Prisma.Decimal(value);

type ActionCase = {
  name: string;
  form: Record<string, string>;
  data?: DataOverrides;
  role?: "ADMIN" | "SELLER" | "WORKSHOP_MASTER";
};

/** Un caso sin formulario usa el formulario valido de su archivo. */
type CaseInput = Omit<ActionCase, "form"> & { form?: ActionCase["form"] };

async function runAction(actionCase: ActionCase) {
  mocks.correlatives.clear();

  const formData = new FormData();

  for (const [key, value] of Object.entries(actionCase.form)) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        await annulPettyCashMovementAction(formData);

        return "termino sin redirigir";
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { ...DEFAULT_DATA, ...actionCase.data },
    { role: actionCase.role ?? "ADMIN" },
  );

  return { calls, outcome: result };
}

/** Egreso de 40.25 en una caja abierta con 100.00 de saldo. */
function movementRow(changes: Record<string, unknown> = {}, box: Record<string, unknown> = {}) {
  return {
    id_movimiento_caja: "MCA00000009",
    id_caja_chica: "CAJ00000002",
    tipo_movimiento: "egreso",
    concepto: "Taxi a proveedor",
    monto: D("40.25"),
    observaciones: null,
    caja_chica: {
      id_caja_chica: "CAJ00000002",
      saldo_actual: D("100.00"),
      estado: "abierta",
      ...box,
    },
    ...changes,
  };
}

const DEFAULT_DATA: DataOverrides = {
  "movimiento_caja.findUnique": movementRow(),
};

const form = (changes: Record<string, string> = {}) => ({
  id_movimiento_caja: "MCA00000009",
  ...changes,
});

const caseInputs: CaseInput[] = [
  { name: "anular un egreso: marca el movimiento y devuelve el monto" },
  {
    name: "anular un ingreso con saldo suficiente: descuenta el monto y conserva la observacion",
    data: { "movimiento_caja.findUnique": movementRow({ tipo_movimiento: "ingreso", concepto: "Reposicion", observaciones: "deposito" }) },
  },
  {
    name: "anular un ingreso sin saldo suficiente",
    data: {
      "movimiento_caja.findUnique": movementRow({ tipo_movimiento: "ingreso", concepto: "Reposicion" }, { saldo_actual: D("40.24") }),
    },
  },
  {
    name: "anular un ajuste negativo: lo trata como egreso",
    data: { "movimiento_caja.findUnique": movementRow({ tipo_movimiento: "ajuste", concepto: "Ajuste negativo: Faltante" }) },
  },
  {
    name: "anular un ajuste positivo: lo trata como ingreso",
    data: { "movimiento_caja.findUnique": movementRow({ tipo_movimiento: "ajuste", concepto: "Ajuste positivo: Sobrante" }) },
  },
  {
    name: "ya estaba anulado",
    data: { "movimiento_caja.findUnique": movementRow({ monto: D("0.00"), observaciones: "[ANULADO] antes" }) },
  },
  {
    name: "caja cerrada",
    data: { "movimiento_caja.findUnique": movementRow({}, { estado: "cerrada" }) },
  },
  { name: "el movimiento no existe", data: { "movimiento_caja.findUnique": null } },
  { name: "sin movimiento en el formulario", form: form({ id_movimiento_caja: "  " }) },
  { name: "sin permiso: el vendedor", role: "SELLER" },
];

const cases: ActionCase[] = caseInputs.map((actionCase) => ({
  form: form(),
  ...actionCase,
}));

describe("annulPettyCashMovementAction", () => {
  for (const actionCase of cases) {
    it(actionCase.name, async () => {
      const { calls, outcome } = await runAction(actionCase);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});
