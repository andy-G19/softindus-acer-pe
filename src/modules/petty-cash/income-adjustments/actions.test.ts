import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createPettyCashIncomeAdjustmentAction } from "@/modules/petty-cash/income-adjustments/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion del ingreso y del ajuste de caja chica (C1 de la 11.4a), escrita antes de tocar
// la accion: hasta aqui no tenia ninguna prueba.
//
// Fija la lectura de la caja (hoy fuera de la transaccion), el tipo y el concepto que guarda cada
// operacion (un ajuste se guarda como «ajuste» y su direccion vive en el concepto: «Ajuste
// positivo: …» o «Ajuste negativo: …»), el aumento o el descuento atomico del saldo, la bitacora,
// las revalidaciones y el resultado.
//
// C6 de la 11.4a (D46): la accion devuelve un resultado en lugar de redirigir o lanzar, reclama la
// clave de la operacion como primera sentencia de la transaccion y pone cada rechazo en su campo.
// Los casos de C1 quedan con el mismo nombre; su resultado es ahora el estado del formulario.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
// Cada respuesta lleva un operationId aleatorio: se fija para que el snapshot sea estable.
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
        return await createPettyCashIncomeAdjustmentAction({ status: "idle" }, formData);
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

const CLAVE = "7a1d3c5e-2b4f-4e6a-8c9d-0e1f2a3b4c5d";

/** La clave ya estaba en la tabla: el INSERT no devuelve filas y se lee la guardada. */
function storedKey(changes: Record<string, unknown> = {}): DataOverrides {
  return {
    "operacion_idempotente.createManyAndReturn": [],
    "operacion_idempotente.findUniqueOrThrow": {
      tipo_operacion: "registrar_ingreso_caja",
      id_usuario: "USU00000001",
      id_registro_resultado: "MCA00000009",
      ...changes,
    },
  };
}

const form = (changes: Record<string, string> = {}) => ({
  clave_operacion: CLAVE,
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
  { name: "sin clave de operacion", form: form({ clave_operacion: "" }) },
  {
    name: "la misma clave ya registrada: responde con el movimiento guardado sin escribir",
    data: storedKey(),
  },
  {
    name: "la clave es de otra operacion",
    data: storedKey({ tipo_operacion: "registrar_egreso_caja" }),
  },
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

// ---------------------------------------------------------------------------
// C3 de la 11.4a (D44): el ingreso y el ajuste deciden con la caja bloqueada
// ---------------------------------------------------------------------------

// Un ajuste negativo leia el saldo fuera de la transaccion, como el egreso: con un egreso
// simultaneo la caja podia quedar en negativo. Ahora bloquea la caja antes de leerla; el ingreso
// tambien, porque decide que la caja este abierta.
describe("C3 de la 11.4a: el ingreso y el ajuste bloquean la caja", () => {
  it.each([
    ["un ingreso", {}],
    ["un ajuste negativo", { tipo_operacion: "ajuste_disminucion", concepto: "Faltante de arqueo" }],
    ["un ajuste negativo que supera el saldo", { tipo_operacion: "ajuste_disminucion", concepto: "Faltante", monto: "100.25" }],
  ])("%s bloquea la caja antes de leerla", async (_name, changes) => {
    const { calls } = await runAction({ name: "C3", form: form(changes) });

    expectRowLockedBefore(calls, {
      table: "caja_chica",
      id: "CAJ00000002",
      reads: (call) => call.prisma === "caja_chica.findUnique",
    });
  });
});

// ---------------------------------------------------------------------------
// C6 de la 11.4a (D46): el ingreso o ajuste con resultado e idempotencia
// ---------------------------------------------------------------------------

describe("C6 de la 11.4a: el ingreso o ajuste reclama su clave primero", () => {
  const index = (calls: Awaited<ReturnType<typeof runAction>>["calls"], name: string) =>
    calls.findIndex((call) => ("prisma" in call && call.prisma === name) || ("effect" in call && call.effect === name));

  it("reclama la clave antes del bloqueo y la completa despues de escribir", async () => {
    const { calls, outcome } = await runAction({ name: "C6", form: form() });

    expect(outcome).toMatchObject({ status: "success", data: { id_movimiento_caja: "MCA00000001", clave_operacion: CLAVE } });
    expect(index(calls, "operacion_idempotente.createManyAndReturn")).toBeGreaterThan(-1);
    expect(index(calls, "operacion_idempotente.createManyAndReturn")).toBeLessThan(index(calls, "$queryRaw"));
    expect(index(calls, "caja_chica.update")).toBeLessThan(index(calls, "operacion_idempotente.updateMany"));
    expect(index(calls, "operacion_idempotente.updateMany")).toBeLessThan(index(calls, "prisma.$transaction:commit"));
  });

  it("un ajuste negativo que supera el saldo deja el error en el monto, con lo enviado", async () => {
    const { calls, outcome } = await runAction({
      name: "C6",
      form: form({ tipo_operacion: "ajuste_disminucion", concepto: "Faltante de arqueo", monto: "100.25" }),
    });

    expect(outcome).toMatchObject({
      status: "error",
      error: "El ajuste negativo supera el saldo disponible de la caja. Saldo actual: S/ 100.00.",
      fieldErrors: { monto: ["El ajuste negativo supera el saldo disponible de la caja. Saldo actual: S/ 100.00."] },
      values: { tipo_operacion: "ajuste_disminucion", monto: "100.25" },
    });
    expect(index(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(index(calls, "operacion_idempotente.updateMany")).toBe(-1);
  });
});
