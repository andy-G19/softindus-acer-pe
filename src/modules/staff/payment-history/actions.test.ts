import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { registerOperatorPaymentAction } from "@/modules/staff/payment-history/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isPrismaCall,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion del pago de planilla (C1 de la 11.5), escrita antes de tocar la accion: hasta
// aqui no tenia ninguna prueba.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion, la lectura de la
// planilla con su operario y su historial (hoy fuera de la transaccion y sin bloquearla), el
// correlativo, el pago, la planilla pagada, la bitacora, el final de la transaccion, las
// revalidaciones y el resultado: la redireccion o el error exacto.

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

/** Un caso sin formulario usa el formulario valido de este archivo. */
type CaseInput = Omit<ActionCase, "form"> & { form?: ActionCase["form"] };

/** Planilla pendiente de 90.00 de neto, sin pagos. */
function payrollRow(changes: Record<string, unknown> = {}) {
  return {
    id_planilla: "PLA00000009",
    id_operario: "OPE00000003",
    periodo_inicio: new Date("2026-11-02T00:00:00.000Z"),
    periodo_fin: new Date("2026-11-08T00:00:00.000Z"),
    monto_neto: D("90.00"),
    estado_pago: "pendiente",
    operario: { id_operario: "OPE00000003", nombres: "Luis", apellidos: "Quispe" },
    historial_pago_operario: [],
    ...changes,
  };
}

const DEFAULT_DATA: DataOverrides = {
  "planilla_pago.findUnique": payrollRow(),
};

const form = (changes: Record<string, string> = {}) => ({
  id_planilla: "PLA00000009",
  fecha_pago: "2026-11-09",
  monto_pagado: "90.00",
  metodo_pago: "efectivo",
  observaciones: "",
  ...changes,
});

async function runAction(actionCase: ActionCase) {
  mocks.correlatives.clear();

  const formData = new FormData();

  for (const [key, value] of Object.entries(actionCase.form)) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        await registerOperatorPaymentAction(formData);

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

const caseInputs: CaseInput[] = [
  { name: "paga el neto: historial, planilla pagada y bitacora" },
  {
    name: "con observaciones y transferencia",
    form: form({ metodo_pago: "transferencia", observaciones: " Abono en cuenta " }),
  },
  {
    name: "un centimo de mas sobre un neto de 30.10",
    form: form({ monto_pagado: "30.11" }),
    data: { "planilla_pago.findUnique": payrollRow({ monto_neto: D("30.10") }) },
  },
  { name: "un centimo de menos sobre 90.00", form: form({ monto_pagado: "89.99" }) },
  { name: "tres decimales sobre 90.00", form: form({ monto_pagado: "90.009" }) },
  { name: "la planilla no existe", data: { "planilla_pago.findUnique": null } },
  { name: "la planilla esta anulada", data: { "planilla_pago.findUnique": payrollRow({ estado_pago: "anulada" }) } },
  { name: "la planilla ya fue pagada", data: { "planilla_pago.findUnique": payrollRow({ estado_pago: "pagado" }) } },
  {
    name: "la planilla ya tiene un pago en el historial",
    data: {
      "planilla_pago.findUnique": payrollRow({
        historial_pago_operario: [{ id_historial_pago: "HPO00000004" }],
      }),
    },
  },
  { name: "monto cero", form: form({ monto_pagado: "0" }) },
  { name: "monto que no es numero", form: form({ monto_pagado: "noventa" }) },
  { name: "metodo de pago desconocido", form: form({ metodo_pago: "cheque" }) },
  { name: "una fecha que no es fecha", form: form({ fecha_pago: "abc" }) },
  { name: "una fecha que no existe", form: form({ fecha_pago: "2026-02-30" }) },
  { name: "sin planilla, fecha ni monto", form: form({ id_planilla: "", fecha_pago: "", monto_pagado: "" }) },
  { name: "sin permiso: el maestro de taller", role: "WORKSHOP_MASTER" },
];

const cases: ActionCase[] = caseInputs.map((actionCase) => ({
  form: form(),
  ...actionCase,
}));

describe("registerOperatorPaymentAction", () => {
  for (const actionCase of cases) {
    it(actionCase.name, async () => {
      const { calls, outcome } = await runAction(actionCase);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});

// --- C4 de la 11.5 (D54): el pago decide con la planilla bloqueada ---

describe("C4 de la 11.5: pagar bloquea la planilla antes de decidir", () => {
  it.each([
    ["una planilla pendiente", {}],
    ["una planilla anulada", { "planilla_pago.findUnique": payrollRow({ estado_pago: "anulada" }) }],
    [
      "una planilla con un pago",
      { "planilla_pago.findUnique": payrollRow({ historial_pago_operario: [{ id_historial_pago: "HPO00000004" }] }) },
    ],
  ] as const)("%s: la planilla se bloquea antes de leerla", async (_name, data) => {
    const { calls } = await runAction({ name: "C4", form: form(), data: { ...data } });

    expectRowLockedBefore(calls, {
      table: "planilla_pago",
      id: "PLA00000009",
      reads: (call) => call.prisma === "planilla_pago.findUnique",
    });
  });

  it("pagar una planilla anulada revierte la transaccion sin escribir", async () => {
    const { calls, outcome } = await runAction({
      name: "C4",
      form: form(),
      data: { "planilla_pago.findUnique": payrollRow({ estado_pago: "anulada" }) },
    });

    expect(outcome).toBe("error: No se puede pagar una planilla anulada.");
    expect(calls.some((call) => "effect" in call && call.effect === "prisma.$transaction:rollback")).toBe(true);
    expect(calls.some((call) => isPrismaCall(call) && call.prisma === "historial_pago_operario.create")).toBe(false);
  });
});
