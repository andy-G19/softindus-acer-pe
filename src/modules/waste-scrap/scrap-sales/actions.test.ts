import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { createScrapSaleAction } from "@/modules/waste-scrap/scrap-sales/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isPrismaCall,
  isRowLock,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion de la venta de chatarra (C1 de la 11.4b), escrita antes de tocar la accion:
// hasta aqui no tenia ninguna prueba.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion, las lecturas de la
// chatarra (con sus ventas) y de la caja (hoy fuera de la transaccion y sin bloquear ninguna), los
// correlativos, el movimiento de caja y el aumento del saldo cuando hay caja, la venta, la chatarra
// vendida, las dos bitacoras, el final de la transaccion, las revalidaciones y el resultado: la
// redireccion o el error exacto. El peso o la cantidad que el formulario deja vacios toman los de
// la chatarra.
//
// C4 de la 11.4b (D48): la accion devuelve un resultado en lugar de redirigir o lanzar, reclama la
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

/** Un caso sin formulario usa el formulario valido de este archivo. */
type CaseInput = Omit<ActionCase, "form"> & { form?: ActionCase["form"] };

/** Chatarra acumulada de 15.00 kg y 3 unidades, sin ventas. */
function scrapRow(changes: Record<string, unknown> = {}) {
  return {
    id_chatarra: "CHA00000004",
    tipo_material: "Retazos de plancha",
    peso_kg: D("15.00"),
    cantidad: D("3.00"),
    estado: "acumulada",
    venta_chatarra: [],
    ...changes,
  };
}

/** Caja abierta. */
function boxRow(changes: Record<string, unknown> = {}) {
  return {
    id_caja_chica: "CAJ00000002",
    estado: "abierta",
    ...changes,
  };
}

const DEFAULT_DATA: DataOverrides = {
  "chatarra.findUnique": scrapRow(),
  "caja_chica.findUnique": boxRow(),
};

const CLAVE = "9c2e4a6b-1d3f-4b5a-8c7d-6e5f4a3b2c1d";

/** La clave ya estaba en la tabla: el INSERT no devuelve filas y se lee la guardada. */
function storedKey(changes: Record<string, unknown> = {}): DataOverrides {
  return {
    "operacion_idempotente.createManyAndReturn": [],
    "operacion_idempotente.findUniqueOrThrow": {
      tipo_operacion: "vender_chatarra",
      id_usuario: "USU00000001",
      id_registro_resultado: "VCH00000009",
      ...changes,
    },
  };
}

const form = (changes: Record<string, string> = {}) => ({
  clave_operacion: CLAVE,
  id_chatarra: "CHA00000004",
  id_caja_chica: "CAJ00000002",
  fecha_venta: "2026-11-10",
  cantidad_vendida: "",
  peso_vendido_kg: "12.50",
  monto_recibido: "80.25",
  destino_dinero: "",
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
        return await createScrapSaleAction({ status: "idle" }, formData);
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
  { name: "venta con caja: movimiento de ingreso, saldo, venta y chatarra vendida" },
  {
    name: "venta sin caja: solo la venta y la chatarra vendida",
    form: form({ id_caja_chica: "", destino_dinero: " Compra de discos ", observaciones: " reciclador " }),
  },
  {
    name: "peso y cantidad vacios: toma los de la chatarra",
    form: form({ peso_vendido_kg: "", cantidad_vendida: "" }),
  },
  {
    name: "chatarra sin peso ni cantidad y formulario vacio",
    form: form({ peso_vendido_kg: "", cantidad_vendida: "" }),
    data: { "chatarra.findUnique": scrapRow({ peso_kg: null, cantidad: null }) },
  },
  { name: "la chatarra no existe", data: { "chatarra.findUnique": null } },
  { name: "la chatarra ya esta vendida", data: { "chatarra.findUnique": scrapRow({ estado: "vendida" }) } },
  {
    name: "la chatarra ya tiene una venta",
    data: { "chatarra.findUnique": scrapRow({ venta_chatarra: [{ id_venta_chatarra: "VCH00000001" }] }) },
  },
  { name: "el peso vendido supera el registrado", form: form({ peso_vendido_kg: "15.01" }) },
  { name: "la cantidad vendida supera la registrada", form: form({ cantidad_vendida: "3.5" }) },
  { name: "la caja no existe", data: { "caja_chica.findUnique": null } },
  { name: "caja cerrada", data: { "caja_chica.findUnique": boxRow({ estado: "cerrada" }) } },
  { name: "monto cero", form: form({ monto_recibido: "0" }) },
  { name: "sin chatarra ni fecha", form: form({ id_chatarra: "", fecha_venta: "" }) },
  { name: "sin permiso: el maestro de taller", role: "WORKSHOP_MASTER" },
  { name: "sin clave de operacion", form: form({ clave_operacion: "" }) },
  {
    name: "la misma clave ya registrada: responde con la venta guardada sin escribir",
    data: storedKey(),
  },
  {
    name: "la clave es de otra operacion",
    data: storedKey({ tipo_operacion: "registrar_ingreso_caja" }),
  },
];

const cases: ActionCase[] = caseInputs.map((actionCase) => ({
  form: form(),
  ...actionCase,
}));

describe("createScrapSaleAction", () => {
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
// C3 de la 11.4b (D48): la venta decide con la chatarra y la caja bloqueadas
// ---------------------------------------------------------------------------

// Dos envios simultaneos leian la chatarra fuera de la transaccion, los dos la veian sin vender y
// los dos la vendian: dos ventas y dos ingresos en la caja. Ahora la venta bloquea la chatarra
// antes de leerla y despues su caja antes de leer su estado, la chatarra primero y la caja al
// final (D44 de la 11.4a). PGlite no prueba la espera: aqui se fija el orden.
describe("C3 de la 11.4b: la venta bloquea la chatarra y despues la caja", () => {
  it.each([
    ["una venta con caja", {}],
    ["una venta con el peso por encima del registrado", { peso_vendido_kg: "15.01" }],
  ])("%s bloquea la chatarra antes de leerla", async (_name, changes) => {
    const { calls } = await runAction({ name: "C3", form: form(changes) });

    expectRowLockedBefore(calls, {
      table: "chatarra",
      id: "CHA00000004",
      reads: (call) => call.prisma === "chatarra.findUnique",
    });
  });

  it("bloquea la caja antes de leerla, despues de la chatarra", async () => {
    const { calls } = await runAction({ name: "C3", form: form() });

    expectRowLockedBefore(calls, {
      table: "caja_chica",
      id: "CAJ00000002",
      reads: (call) => call.prisma === "caja_chica.findUnique",
    });
    expect(
      calls.findIndex((call) => isRowLock(call, "chatarra", "CHA00000004")),
      "la chatarra se bloquea antes que la caja",
    ).toBeLessThan(calls.findIndex((call) => isRowLock(call, "caja_chica", "CAJ00000002")));
  });

  it("una venta sin caja no bloquea ninguna caja", async () => {
    const { calls } = await runAction({ name: "C3", form: form({ id_caja_chica: "" }) });

    expectRowLockedBefore(calls, {
      table: "chatarra",
      id: "CHA00000004",
      reads: (call) => call.prisma === "chatarra.findUnique",
    });
    // Ningun SELECT ... FROM aceros.caja_chica: sin caja no hay fila que bloquear.
    const boxLocks = calls.filter(
      (call) => isPrismaCall(call) && call.prisma === "$queryRaw" && String((call.args as { sql: string }).sql).includes("aceros.caja_chica"),
    );

    expect(boxLocks).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// C4 de la 11.4b (D48): la venta con resultado e idempotencia
// ---------------------------------------------------------------------------

describe("C4 de la 11.4b: la venta reclama su clave primero", () => {
  const index = (calls: Awaited<ReturnType<typeof runAction>>["calls"], name: string) =>
    calls.findIndex((call) => ("prisma" in call && call.prisma === name) || ("effect" in call && call.effect === name));

  it("reclama la clave antes de los candados y la completa despues de escribir", async () => {
    const { calls, outcome } = await runAction({ name: "C4", form: form() });

    expect(outcome).toMatchObject({ status: "success", data: { id_venta_chatarra: "VCH00000001", clave_operacion: CLAVE } });
    expect(index(calls, "operacion_idempotente.createManyAndReturn")).toBeGreaterThan(-1);
    expect(index(calls, "operacion_idempotente.createManyAndReturn")).toBeLessThan(index(calls, "$queryRaw"));
    expect(index(calls, "chatarra.update")).toBeLessThan(index(calls, "operacion_idempotente.updateMany"));
    expect(index(calls, "operacion_idempotente.updateMany")).toBeLessThan(index(calls, "prisma.$transaction:commit"));
  });

  it.each([
    ["la chatarra ya vendida", { "chatarra.findUnique": scrapRow({ estado: "vendida" }) }, {}, "id_chatarra"],
    ["el peso por encima del registrado", {}, { peso_vendido_kg: "15.01" }, "peso_vendido_kg"],
    ["la cantidad por encima de la registrada", {}, { cantidad_vendida: "3.5" }, "cantidad_vendida"],
    ["la caja cerrada", { "caja_chica.findUnique": boxRow({ estado: "cerrada" }) }, {}, "id_caja_chica"],
  ] as const)("%s revierte la transaccion y deja el error en su campo, con lo enviado", async (_name, data, changes, field) => {
    const { calls, outcome } = await runAction({ name: "C4", form: form(changes), data: { ...data } });

    expect(outcome).toMatchObject({ status: "error", values: { id_chatarra: "CHA00000004", monto_recibido: "80.25" } });
    expect(Object.keys((outcome as { fieldErrors?: Record<string, unknown> }).fieldErrors ?? {})).toEqual([field]);
    expect(index(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(index(calls, "operacion_idempotente.updateMany")).toBe(-1);
  });
});
