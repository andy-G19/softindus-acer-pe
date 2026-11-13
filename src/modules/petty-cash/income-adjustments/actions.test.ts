import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createPettyCashIncomeAdjustmentAction } from "@/modules/petty-cash/income-adjustments/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion del ingreso y del ajuste de caja chica (C1 de la 11.4a), escrita antes de tocar
// la accion: hasta aqui no tenia ninguna prueba.
//
// Fija la lectura de la caja (hoy fuera de la transaccion), el tipo y el concepto que guarda cada
// operacion (un ajuste se guarda como «ajuste» y su direccion vive en el concepto: «Ajuste
// positivo: …» o «Ajuste negativo: …»), el aumento o el descuento atomico del saldo, la bitacora,
// las revalidaciones y el resultado.

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
        await createPettyCashIncomeAdjustmentAction(formData);

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

/** Caja abierta con 100.00 de saldo. */
function boxRow(changes: Record<string, unknown> = {}) {
  return {
    id_caja_chica: "CAJ00000002",
    nombre_caja: "Caja taller",
    saldo_actual: D("100.00"),
    estado: "abierta",
    ...changes,
  };
}

const DEFAULT_DATA: DataOverrides = {
  "caja_chica.findUnique": boxRow(),
};

const form = (changes: Record<string, string> = {}) => ({
  id_caja_chica: "CAJ00000002",
  tipo_operacion: "ingreso",
  concepto: "Reposicion de caja",
  monto: "60.50",
  fecha_movimiento: "2026-11-10",
  comprobante: "",
  responsable: "",
  observaciones: "",
  ...changes,
});

const caseInputs: CaseInput[] = [
  { name: "ingreso: crea el movimiento y aumenta el saldo" },
  {
    name: "ajuste positivo: tipo ajuste, concepto y observacion con su direccion",
    form: form({ tipo_operacion: "ajuste_incremento", concepto: "Sobrante de arqueo", observaciones: "conteo" }),
  },
  {
    name: "ajuste negativo por todo el saldo: descuenta",
    form: form({ tipo_operacion: "ajuste_disminucion", concepto: "Faltante de arqueo", monto: "100" }),
  },
  {
    name: "ajuste negativo que supera el saldo",
    form: form({ tipo_operacion: "ajuste_disminucion", concepto: "Faltante de arqueo", monto: "100.25" }),
  },
  {
    name: "un ingreso no mira el saldo",
    form: form({ monto: "500" }),
    data: { "caja_chica.findUnique": boxRow({ saldo_actual: D("0.00") }) },
  },
  { name: "la caja no existe", data: { "caja_chica.findUnique": null } },
  { name: "caja cerrada", data: { "caja_chica.findUnique": boxRow({ estado: "cerrada" }) } },
  { name: "tipo de operacion invalido", form: form({ tipo_operacion: "retiro" }) },
  { name: "monto cero", form: form({ monto: "0" }) },
  { name: "sin permiso: el maestro de taller", role: "WORKSHOP_MASTER" },
];

const cases: ActionCase[] = caseInputs.map((actionCase) => ({
  form: form(),
  ...actionCase,
}));

describe("createPettyCashIncomeAdjustmentAction", () => {
  for (const actionCase of cases) {
    it(actionCase.name, async () => {
      const { calls, outcome } = await runAction(actionCase);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});
