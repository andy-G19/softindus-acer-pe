import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { annulPettyCashMovementAction } from "@/modules/petty-cash/movements/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isRowLock,
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
//
// C8 de la 11.4a (D47): la accion devuelve RowStatusState en lugar de redirigir o lanzar; un
// rechazo se devuelve desde la transaccion antes de escribir y no revalida. Los casos de C1 quedan
// con el mismo nombre; su resultado es ahora el estado de la fila.

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
        return await annulPettyCashMovementAction({ status: "idle" }, formData);
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

/** Egreso de 40.25 de la caja CAJ00000002. */
function movementRow(changes: Record<string, unknown> = {}) {
  return {
    id_movimiento_caja: "MCA00000009",
    id_caja_chica: "CAJ00000002",
    tipo_movimiento: "egreso",
    concepto: "Taxi a proveedor",
    monto: D("40.25"),
    observaciones: null,
    // Las ventas de chatarra que registraron este movimiento: ninguna, salvo en C4 de la 11.4a.
    venta_chatarra: [],
    ...changes,
  };
}

/**
 * La caja abierta con 100.00 de saldo. Desde C3 de la 11.4a se lee aparte y despues de bloquearla;
 * antes llegaba incluida en el movimiento.
 */
function boxRow(changes: Record<string, unknown> = {}) {
  return {
    saldo_actual: D("100.00"),
    estado: "abierta",
    ...changes,
  };
}

const DEFAULT_DATA: DataOverrides = {
  "movimiento_caja.findUnique": movementRow(),
  "caja_chica.findUnique": boxRow(),
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
      "movimiento_caja.findUnique": movementRow({ tipo_movimiento: "ingreso", concepto: "Reposicion" }),
      "caja_chica.findUnique": boxRow({ saldo_actual: D("40.24") }),
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
    data: { "caja_chica.findUnique": boxRow({ estado: "cerrada" }) },
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

// ---------------------------------------------------------------------------
// C3 de la 11.4a (D44): anular decide con el movimiento y la caja bloqueados
// ---------------------------------------------------------------------------

// Dos anulaciones simultaneas del mismo movimiento leian la marca [ANULADO] sin bloquear la fila:
// las dos la veian ausente y las dos devolvian el monto a la caja. Y anular un ingreso comparaba
// el saldo leido junto con el movimiento, sin bloquear la caja. Ahora anular bloquea el
// movimiento antes de leerlo y despues su caja antes de leer el saldo: el movimiento primero y la
// caja al final, el orden de toda la 11.4. La caja se lee aparte, ya bloqueada.
describe("C3 de la 11.4a: anular bloquea el movimiento y despues la caja", () => {
  it.each([
    ["anular un egreso", {}],
    ["anular un ingreso sin saldo suficiente", { tipo_movimiento: "ingreso", concepto: "Reposicion", monto: D("200.00") }],
  ])("%s bloquea el movimiento antes de leerlo y la caja antes de leer su saldo", async (_name, changes) => {
    const { calls } = await runAction({
      name: "C3",
      form: form(),
      data: {
        "movimiento_caja.findUnique": movementRow(changes),
        "caja_chica.findUnique": boxRow(),
      },
    });

    expectRowLockedBefore(calls, {
      table: "movimiento_caja",
      id: "MCA00000009",
      reads: (call) => call.prisma === "movimiento_caja.findUnique",
    });
    expectRowLockedBefore(calls, {
      table: "caja_chica",
      id: "CAJ00000002",
      reads: (call) => call.prisma === "caja_chica.findUnique",
    });
    expect(
      calls.findIndex((call) => isRowLock(call, "movimiento_caja", "MCA00000009")),
      "el movimiento se bloquea antes que su caja",
    ).toBeLessThan(calls.findIndex((call) => isRowLock(call, "caja_chica", "CAJ00000002")));
  });
});

// ---------------------------------------------------------------------------
// C4 de la 11.4a (D45): el ingreso de una venta de chatarra no se anula desde caja chica
// ---------------------------------------------------------------------------

// Una venta de chatarra con caja registra un ingreso en ella. Anular ese ingreso devolvia el
// dinero y dejaba la venta registrada y la chatarra «vendida»: la venta y la caja se
// contradecian. Decision de negocio D45: se rechaza, con la venta nombrada, sin escribir nada.
describe("C4 de la 11.4a: el ingreso de una venta de chatarra no se anula", () => {
  it("rechaza el ingreso de una venta y no toca el movimiento ni la caja", async () => {
    const { calls, outcome } = await runAction({
      name: "C4",
      form: form(),
      data: {
        "movimiento_caja.findUnique": movementRow({
          tipo_movimiento: "ingreso",
          concepto: "Venta de chatarra CHA00000004",
          venta_chatarra: [{ id_venta_chatarra: "VCH00000003" }],
        }),
      },
    });

    // C8 de la 11.4a: el rechazo llega como el estado de la fila, para la confirmacion.
    expect(outcome).toMatchObject({
      status: "error",
      error: "Este ingreso es de la venta de chatarra VCH00000003; no se anula desde caja chica.",
    });
    expect(
      calls.filter((call) => "prisma" in call && (call.prisma === "movimiento_caja.update" || call.prisma === "caja_chica.update")),
    ).toEqual([]);
  });

  it("un ingreso sin venta se sigue anulando", async () => {
    const { outcome } = await runAction({
      name: "C4",
      form: form(),
      data: { "movimiento_caja.findUnique": movementRow({ tipo_movimiento: "ingreso", concepto: "Reposicion" }) },
    });

    expect(outcome).toMatchObject({ status: "success", data: { estado: "anulado" } });
  });
});

// ---------------------------------------------------------------------------
// C8 de la 11.4a (D47): anular responde a la confirmacion
// ---------------------------------------------------------------------------

describe("C8 de la 11.4a: anular responde con el estado de la fila", () => {
  it("un rechazo no revalida: el repintado quitaria el boton y su mensaje", async () => {
    const { calls, outcome } = await runAction({
      name: "C8",
      form: form(),
      data: { "movimiento_caja.findUnique": movementRow({ observaciones: "[ANULADO] antes" }) },
    });

    expect(outcome).toMatchObject({
      status: "error",
      error: "No se puede anular un movimiento ya anulado.",
      values: { id: "MCA00000009" },
    });
    expect(calls.some((call) => "effect" in call && call.effect === "revalidatePath")).toBe(false);
  });

  it("anular revalida el listado y responde con el estado anulado", async () => {
    const { calls, outcome } = await runAction({ name: "C8", form: form() });

    expect(outcome).toMatchObject({ status: "success", data: { estado: "anulado" }, values: { id: "MCA00000009" } });
    expect(calls.some((call) => "effect" in call && call.effect === "revalidatePath" && call.args === "/dashboard/petty-cash/movements")).toBe(true);
  });
});
