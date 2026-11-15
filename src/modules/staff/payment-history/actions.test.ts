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
//
// Desde C7 de la 11.5 (D59) el pago devuelve su resultado (FormActionState): reclama la clave de
// la operacion como primera sentencia de la transaccion y pone cada rechazo en su campo.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/action-result", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/action-result")>()),
  newOperationId: () => "operacion-de-prueba",
}));
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

const CLAVE = "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d";

/** La clave ya estaba en la tabla: el INSERT no devuelve filas y se lee la guardada. */
function storedKey(changes: Record<string, unknown> = {}): DataOverrides {
  return {
    "operacion_idempotente.createManyAndReturn": [],
    "operacion_idempotente.findUniqueOrThrow": {
      tipo_operacion: "pagar_planilla",
      id_usuario: "USU00000001",
      id_registro_resultado: "HPO00000004",
      ...changes,
    },
  };
}

const form = (changes: Record<string, string> = {}) => ({
  clave_operacion: CLAVE,
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
        return await registerOperatorPaymentAction({ status: "idle" }, formData);
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
  { name: "sin clave de operacion", form: form({ clave_operacion: "" }) },
  {
    name: "la misma clave ya registrada: responde con el pago registrado sin escribir",
    data: storedKey(),
  },
  {
    name: "la clave es de otra operacion",
    data: storedKey({ tipo_operacion: "generar_planilla" }),
  },
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

    expect(outcome).toMatchObject({
      status: "error",
      fieldErrors: { id_planilla: ["No se puede pagar una planilla anulada."] },
    });
    expect(calls.some((call) => "effect" in call && call.effect === "prisma.$transaction:rollback")).toBe(true);
    expect(calls.some((call) => isPrismaCall(call) && call.prisma === "historial_pago_operario.create")).toBe(false);
  });
});

// --- C7 de la 11.5 (D59): el pago reclama su clave primero ---

describe("C7 de la 11.5: pagar reclama la clave antes del candado", () => {
  const at = (calls: Awaited<ReturnType<typeof runAction>>["calls"], name: string) =>
    calls.findIndex((call) => (isPrismaCall(call) ? call.prisma === name : "effect" in call && call.effect === name));

  it("reclama la clave antes del candado y la completa despues de escribir", async () => {
    const { calls, outcome } = await runAction({ name: "C7", form: form() });

    expect(outcome).toMatchObject({ status: "success", data: { id_historial_pago: "HPO00000001", clave_operacion: CLAVE } });
    expect(at(calls, "operacion_idempotente.createManyAndReturn")).toBeGreaterThan(-1);
    expect(at(calls, "operacion_idempotente.createManyAndReturn")).toBeLessThan(at(calls, "$queryRaw"));
    expect(at(calls, "planilla_pago.update")).toBeLessThan(at(calls, "operacion_idempotente.updateMany"));
    expect(at(calls, "operacion_idempotente.updateMany")).toBeLessThan(at(calls, "prisma.$transaction:commit"));
  });

  it.each([
    ["una planilla pagada", { "planilla_pago.findUnique": payrollRow({ estado_pago: "pagado" }) }, {}, "id_planilla"],
    ["un monto distinto del neto", {}, { monto_pagado: "90.01" }, "monto_pagado"],
  ] as const)("%s revierte la transaccion y deja el error en su campo, con lo enviado", async (_name, data, changes, field) => {
    const { calls, outcome } = await runAction({ name: "C7", form: form(changes), data: { ...data } });

    expect(outcome).toMatchObject({ status: "error", values: { id_planilla: "PLA00000009", metodo_pago: "efectivo" } });
    expect(Object.keys((outcome as { fieldErrors?: Record<string, unknown> }).fieldErrors ?? {})).toEqual([field]);
    expect(at(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(at(calls, "operacion_idempotente.updateMany")).toBe(-1);
  });
});
