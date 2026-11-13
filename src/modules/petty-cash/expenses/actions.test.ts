import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createPettyCashExpenseAction } from "@/modules/petty-cash/expenses/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion del egreso de caja chica (C1 de la 11.4a), escrita antes de tocar la accion:
// hasta aqui no tenia ninguna prueba.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion, las lecturas de la
// caja y de la categoria (hoy fuera de la transaccion y sin bloquear la caja), el correlativo, el
// movimiento, el descuento atomico del saldo, la bitacora, el final de la transaccion, las
// revalidaciones y el resultado: la redireccion o el error exacto.
//
// C5 de la 11.4a (D46): la accion devuelve un resultado en lugar de redirigir o lanzar, reclama la
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
        return await createPettyCashExpenseAction({ status: "idle" }, formData);
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

function categoryRow(changes: Record<string, unknown> = {}) {
  return {
    id_categoria_gasto: "CGA00000003",
    nombre_categoria: "Movilidad",
    estado: true,
    ...changes,
  };
}

const DEFAULT_DATA: DataOverrides = {
  "caja_chica.findUnique": boxRow(),
  "categoria_gasto.findUnique": categoryRow(),
};

const CLAVE = "5f0c2b7e-8d41-4c3a-9b6e-1a2b3c4d5e6f";

/** La clave ya estaba en la tabla: el INSERT no devuelve filas y se lee la guardada. */
function storedKey(changes: Record<string, unknown> = {}): DataOverrides {
  return {
    "operacion_idempotente.createManyAndReturn": [],
    "operacion_idempotente.findUniqueOrThrow": {
      tipo_operacion: "registrar_egreso_caja",
      id_usuario: "USU00000001",
      id_registro_resultado: "MCA00000009",
      ...changes,
    },
  };
}

const form = (changes: Record<string, string> = {}) => ({
  clave_operacion: CLAVE,
  id_caja_chica: "CAJ00000002",
  id_categoria_gasto: "CGA00000003",
  concepto: "Taxi a proveedor",
  monto: "40.25",
  fecha_movimiento: "2026-11-10",
  comprobante: "",
  responsable: "",
  observaciones: "",
  ...changes,
});

const caseInputs: CaseInput[] = [
  { name: "egreso valido: crea el movimiento y descuenta el saldo" },
  {
    name: "egreso por todo el saldo, con comprobante, responsable y observaciones",
    form: form({ monto: "100", comprobante: " B001-77 ", responsable: " Luis ", observaciones: " pagado " }),
  },
  { name: "la caja no existe", data: { "caja_chica.findUnique": null } },
  { name: "caja cerrada", data: { "caja_chica.findUnique": boxRow({ estado: "cerrada" }) } },
  { name: "el egreso supera el saldo", form: form({ monto: "100.25" }) },
  { name: "la categoria no existe", data: { "categoria_gasto.findUnique": null } },
  { name: "categoria inactiva", data: { "categoria_gasto.findUnique": categoryRow({ estado: false }) } },
  { name: "monto cero", form: form({ monto: "0" }) },
  { name: "monto que no es numero", form: form({ monto: "abc" }) },
  { name: "concepto corto y sin caja", form: form({ concepto: "ab", id_caja_chica: "" }) },
  { name: "sin permiso: el vendedor", role: "SELLER" },
  { name: "sin clave de operacion", form: form({ clave_operacion: "" }) },
  {
    name: "la misma clave ya registrada: responde con el egreso guardado sin escribir",
    data: storedKey(),
  },
  {
    name: "la clave es de otra operacion",
    data: storedKey({ tipo_operacion: "crear_proforma" }),
  },
];

const cases: ActionCase[] = caseInputs.map((actionCase) => ({
  form: form(),
  ...actionCase,
}));

describe("createPettyCashExpenseAction", () => {
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
// C3 de la 11.4a (D44): el egreso decide con la caja bloqueada
// ---------------------------------------------------------------------------

// Dos egresos simultaneos leian el saldo fuera de la transaccion, los dos lo veian suficiente y
// los dos restaban: la caja quedaba en negativo. Ahora el egreso bloquea la caja dentro de la
// transaccion antes de leerla, y lee la caja y la categoria con `tx`: el segundo espera al
// primero y ve el saldo ya descontado. PGlite no prueba la espera (una transaccion a la vez):
// aqui se fija el orden.
describe("C3 de la 11.4a: el egreso bloquea la caja", () => {
  it.each([
    ["un egreso valido", {}],
    ["un egreso que supera el saldo", { monto: "100.25" }],
  ])("%s bloquea la caja antes de leer la caja y la categoria", async (_name, changes) => {
    const { calls } = await runAction({ name: "C3", form: form(changes) });

    expectRowLockedBefore(calls, {
      table: "caja_chica",
      id: "CAJ00000002",
      reads: (call) => call.prisma === "caja_chica.findUnique" || call.prisma === "categoria_gasto.findUnique",
    });
  });
});

// ---------------------------------------------------------------------------
// C5 de la 11.4a (D46): el egreso con resultado e idempotencia
// ---------------------------------------------------------------------------

// La clave se reclama como primera sentencia de la transaccion, antes del bloqueo de la caja y del
// correlativo, y se completa con el egreso antes de confirmar: un reenvio con la misma clave
// espera y responde con el egreso ya guardado.
describe("C5 de la 11.4a: el egreso reclama su clave primero", () => {
  const index = (calls: Awaited<ReturnType<typeof runAction>>["calls"], name: string) =>
    calls.findIndex((call) => ("prisma" in call && call.prisma === name) || ("effect" in call && call.effect === name));

  it("reclama la clave antes del bloqueo y la completa despues de escribir", async () => {
    const { calls, outcome } = await runAction({ name: "C5", form: form() });

    expect(outcome).toMatchObject({ status: "success", data: { id_movimiento_caja: "MCA00000001", clave_operacion: CLAVE } });
    expect(index(calls, "operacion_idempotente.createManyAndReturn")).toBeGreaterThan(-1);
    expect(index(calls, "operacion_idempotente.createManyAndReturn")).toBeLessThan(index(calls, "$queryRaw"));
    expect(index(calls, "caja_chica.update")).toBeLessThan(index(calls, "operacion_idempotente.updateMany"));
    expect(index(calls, "operacion_idempotente.updateMany")).toBeLessThan(index(calls, "prisma.$transaction:commit"));
  });

  it("un rechazo despues del reclamo revierte la transaccion y deja el error en su campo", async () => {
    const { calls, outcome } = await runAction({ name: "C5", form: form({ monto: "100.25" }) });

    expect(outcome).toMatchObject({
      status: "error",
      error: "El egreso supera el saldo disponible de la caja. Saldo actual: S/ 100.00.",
      fieldErrors: { monto: ["El egreso supera el saldo disponible de la caja. Saldo actual: S/ 100.00."] },
      values: { monto: "100.25", concepto: "Taxi a proveedor" },
    });
    expect(index(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(index(calls, "operacion_idempotente.updateMany")).toBe(-1);
  });
});
