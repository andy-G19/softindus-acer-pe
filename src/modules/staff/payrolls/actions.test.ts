import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { cancelPayrollAction, generatePayrollAction } from "@/modules/staff/payrolls/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isPrismaCall,
  type DataOverrides,
  type RecordedCall,
} from "@/testing/page-characterization";

// Caracterizacion de generar y anular planillas (C1 de la 11.5), escrita antes de tocar las
// acciones: hasta aqui no tenian ninguna prueba.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion, las lecturas (hoy
// fuera de la transaccion y sin bloquear ninguna fila), el correlativo, la escritura, la
// bitacora, el final de la transaccion, las revalidaciones y el resultado: la redireccion o el
// error exacto. Generar tambien escribe en la consola del servidor: el caso lo registra.
//
// Desde C6 de la 11.5 (D59) generar devuelve su resultado (FormActionState): reclama la clave de
// la operacion como primera sentencia de la transaccion, pone cada rechazo en su campo y ya no
// escribe en la consola. Anular todavia redirige (C8).

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

type Role = "ADMIN" | "SELLER" | "WORKSHOP_MASTER";

type ActionCase = {
  name: string;
  form: Record<string, string>;
  data?: DataOverrides;
  role?: Role;
};

/** Un caso sin formulario usa el formulario valido de su accion. */
type CaseInput = Omit<ActionCase, "form"> & { form?: ActionCase["form"] };

let consoleLog: MockInstance<typeof console.log>;

beforeEach(() => {
  consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  consoleLog.mockRestore();
});

async function run(
  action: (formData: FormData) => Promise<unknown>,
  actionCase: ActionCase,
  defaults: DataOverrides,
) {
  mocks.correlatives.clear();

  const formData = new FormData();

  for (const [key, value] of Object.entries(actionCase.form)) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        return (await action(formData)) ?? "termino sin redirigir";
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    { ...defaults, ...actionCase.data },
    { role: actionCase.role ?? "ADMIN" },
  );

  return { calls, outcome: { resultado: result, consola: consoleLog.mock.calls } };
}

// --- Generar planilla ---

/** Operario activo, quincenal, con una tarifa de 50.00. */
function operatorRow(changes: Record<string, unknown> = {}) {
  return {
    id_operario: "OPE00000003",
    nombres: "Luis",
    apellidos: "Quispe",
    modalidad_pago: "quincenal",
    tarifa: D("50.00"),
    ...changes,
  };
}

/** Dos asistencias validas (una con tardanza) y una falta. */
const ATTENDANCES = [
  { id_asistencia: "ASI00000011", falta: false, tardanza: false, horas_trabajadas: D("8.00") },
  { id_asistencia: "ASI00000012", falta: false, tardanza: true, horas_trabajadas: D("7.50") },
  { id_asistencia: "ASI00000013", falta: true, tardanza: false, horas_trabajadas: null },
];

const GENERATE_DATA: DataOverrides = {
  "operario.findFirst": operatorRow(),
  "planilla_pago.findFirst": null,
  "asistencia.findMany": ATTENDANCES,
};

const CLAVE = "5b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

/** La clave ya estaba en la tabla: el INSERT no devuelve filas y se lee la guardada. */
function storedKey(changes: Record<string, unknown> = {}): DataOverrides {
  return {
    "operacion_idempotente.createManyAndReturn": [],
    "operacion_idempotente.findUniqueOrThrow": {
      tipo_operacion: "generar_planilla",
      id_usuario: "USU00000001",
      id_registro_resultado: "PLA00000009",
      ...changes,
    },
  };
}

/** Generar recibe el estado anterior del formulario. */
const generate = (formData: FormData) => generatePayrollAction({ status: "idle" }, formData);

const generateForm = (changes: Record<string, string> = {}) => ({
  clave_operacion: CLAVE,
  id_operario: "OPE00000003",
  periodo_inicio: "2026-11-02",
  periodo_fin: "2026-11-08",
  descuentos: "10.00",
  ...changes,
});

const generateInputs: CaseInput[] = [
  { name: "genera: dos asistencias validas por la tarifa, menos el descuento" },
  { name: "descuento vacio: cero", form: generateForm({ descuentos: "" }) },
  { name: "descuento con tres decimales", form: generateForm({ descuentos: "10.005" }) },
  { name: "descuento igual al bruto: neto cero", form: generateForm({ descuentos: "100" }) },
  { name: "descuento mayor que el bruto", form: generateForm({ descuentos: "100.01" }) },
  { name: "descuento negativo", form: generateForm({ descuentos: "-1" }) },
  { name: "descuento que no es numero", form: generateForm({ descuentos: "diez" }) },
  { name: "el operario no existe o esta inactivo", data: { "operario.findFirst": null } },
  { name: "operario sin tarifa", data: { "operario.findFirst": operatorRow({ tarifa: null }) } },
  {
    name: "ya hay una planilla del mismo periodo",
    data: { "planilla_pago.findFirst": { id_planilla: "PLA00000007", estado_pago: "anulada" } },
  },
  {
    name: "solo faltas en el periodo",
    data: { "asistencia.findMany": [ATTENDANCES[2]] },
  },
  {
    name: "el fin antes del inicio",
    form: generateForm({ periodo_inicio: "2026-11-08", periodo_fin: "2026-11-02" }),
  },
  { name: "una fecha que no es fecha", form: generateForm({ periodo_fin: "abc" }) },
  { name: "una fecha que no existe", form: generateForm({ periodo_fin: "2026-02-30", periodo_inicio: "2026-02-23" }) },
  { name: "sin operario ni fechas", form: generateForm({ id_operario: "", periodo_inicio: "", periodo_fin: "" }) },
  { name: "sin permiso: el maestro de taller", role: "WORKSHOP_MASTER" },
  { name: "sin clave de operacion", form: generateForm({ clave_operacion: "" }) },
  {
    name: "la misma clave ya registrada: responde con la planilla generada sin escribir",
    data: storedKey(),
  },
  {
    name: "la clave es de otra operacion",
    data: storedKey({ tipo_operacion: "pagar_planilla" }),
  },
];

describe("generatePayrollAction", () => {
  for (const input of generateInputs) {
    it(input.name, async () => {
      const { calls, outcome } = await run(
        generate,
        { form: generateForm(), ...input },
        GENERATE_DATA,
      );

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});

// --- Anular planilla ---

/** Planilla pendiente sin pagos. */
function payrollRow(changes: Record<string, unknown> = {}) {
  return {
    id_planilla: "PLA00000009",
    id_operario: "OPE00000003",
    estado_pago: "pendiente",
    _count: { historial_pago_operario: 0 },
    ...changes,
  };
}

const CANCEL_DATA: DataOverrides = {
  "planilla_pago.findUnique": payrollRow(),
};

const cancelForm = (changes: Record<string, string> = {}) => ({
  id_planilla: "PLA00000009",
  ...changes,
});

const cancelInputs: CaseInput[] = [
  { name: "anula una planilla pendiente sin pagos" },
  { name: "sin planilla en el formulario", form: cancelForm({ id_planilla: "" }) },
  { name: "la planilla no existe", data: { "planilla_pago.findUnique": null } },
  { name: "la planilla ya fue pagada", data: { "planilla_pago.findUnique": payrollRow({ estado_pago: "pagado" }) } },
  {
    name: "la planilla tiene un pago en el historial",
    data: { "planilla_pago.findUnique": payrollRow({ _count: { historial_pago_operario: 1 } }) },
  },
  { name: "la planilla ya esta anulada", data: { "planilla_pago.findUnique": payrollRow({ estado_pago: "anulada" }) } },
  { name: "sin permiso: el maestro de taller", role: "WORKSHOP_MASTER" },
];

describe("cancelPayrollAction", () => {
  for (const input of cancelInputs) {
    it(input.name, async () => {
      const { calls, outcome } = await run(cancelPayrollAction, { form: cancelForm(), ...input }, CANCEL_DATA);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(outcome).toMatchSnapshot("resultado");
    });
  }
});

// --- C4 de la 11.5 (D54): deciden con su fila bloqueada ---

const effectIndex = (calls: RecordedCall[], name: string) =>
  calls.findIndex((call) => "effect" in call && call.effect === name);

const prismaIndex = (calls: RecordedCall[], name: string) =>
  calls.findIndex((call) => isPrismaCall(call) && call.prisma === name);

describe("C4 de la 11.5: generar bloquea el operario antes de decidir", () => {
  const GENERATE_READS = ["operario.findFirst", "planilla_pago.findFirst", "asistencia.findMany"];

  it.each([
    ["una planilla valida", {}],
    ["un periodo ya generado", { "planilla_pago.findFirst": { id_planilla: "PLA00000007", estado_pago: "pendiente" } }],
    ["solo faltas", { "asistencia.findMany": [ATTENDANCES[2]] }],
  ] as const)("%s: el operario se bloquea antes de leerlo y la transaccion sigue abierta", async (_name, data) => {
    const { calls } = await run(generate, { name: "C4", form: generateForm(), data: { ...data } }, GENERATE_DATA);

    expectRowLockedBefore(calls, {
      table: "operario",
      id: "OPE00000003",
      reads: (call) => GENERATE_READS.includes(call.prisma),
    });
  });

  it("un rechazo dentro de la transaccion la revierte sin escribir", async () => {
    const { calls, outcome } = await run(
      generate,
      {
        name: "C4",
        form: generateForm(),
        data: { "planilla_pago.findFirst": { id_planilla: "PLA00000007", estado_pago: "pendiente" } },
      },
      GENERATE_DATA,
    );

    expect(outcome.resultado).toMatchObject({
      status: "error",
      error: "Este operario ya tiene una planilla generada para el periodo seleccionado.",
      fieldErrors: { periodo_inicio: ["Este operario ya tiene una planilla generada para el periodo seleccionado."] },
    });
    expect(effectIndex(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(prismaIndex(calls, "planilla_pago.create")).toBe(-1);
  });
});

describe("C4 de la 11.5: anular bloquea la planilla antes de decidir", () => {
  it.each([
    ["una planilla pendiente", {}],
    ["una planilla pagada", { "planilla_pago.findUnique": payrollRow({ estado_pago: "pagado" }) }],
    ["una planilla con historial", { "planilla_pago.findUnique": payrollRow({ _count: { historial_pago_operario: 1 } }) }],
  ] as const)("%s: la planilla se bloquea antes de leerla", async (_name, data) => {
    const { calls } = await run(cancelPayrollAction, { name: "C4", form: cancelForm(), data: { ...data } }, CANCEL_DATA);

    expectRowLockedBefore(calls, {
      table: "planilla_pago",
      id: "PLA00000009",
      reads: (call) => call.prisma === "planilla_pago.findUnique",
    });
  });

  it("anular una planilla pagada revierte la transaccion sin escribir", async () => {
    const { calls, outcome } = await run(
      cancelPayrollAction,
      { name: "C4", form: cancelForm(), data: { "planilla_pago.findUnique": payrollRow({ estado_pago: "pagado" }) } },
      CANCEL_DATA,
    );

    expect(outcome.resultado).toBe("error: No se puede anular una planilla que ya fue pagada.");
    expect(effectIndex(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(prismaIndex(calls, "planilla_pago.update")).toBe(-1);
  });
});

// --- C6 de la 11.5 (D59): generar reclama su clave primero ---

describe("C6 de la 11.5: generar reclama la clave antes del candado", () => {
  it("reclama la clave antes del candado y la completa despues de escribir", async () => {
    const { calls, outcome } = await run(generate, { name: "C6", form: generateForm() }, GENERATE_DATA);
    const at = (name: string) => calls.findIndex((call) => isPrismaCall(call) && call.prisma === name);

    expect(outcome.resultado).toMatchObject({
      status: "success",
      data: { id_planilla: "PLA00000001", clave_operacion: CLAVE },
    });
    expect(at("operacion_idempotente.createManyAndReturn")).toBeGreaterThan(-1);
    expect(at("operacion_idempotente.createManyAndReturn")).toBeLessThan(at("$queryRaw"));
    expect(at("planilla_pago.create")).toBeLessThan(at("operacion_idempotente.updateMany"));
    expect(at("operacion_idempotente.updateMany")).toBeLessThan(effectIndex(calls, "prisma.$transaction:commit"));
    // Ya no escribe en la consola del servidor (hallazgo 9).
    expect(outcome.consola).toEqual([]);
  });

  it.each([
    ["el operario inactivo", { "operario.findFirst": null }, {}, "id_operario"],
    ["un periodo que se cruza", { "planilla_pago.findFirst": { id_planilla: "PLA00000007", estado_pago: "pendiente" } }, {}, "periodo_inicio"],
    ["solo faltas", { "asistencia.findMany": [ATTENDANCES[2]] }, {}, "periodo_inicio"],
    ["un descuento igual al bruto", {}, { descuentos: "100" }, "descuentos"],
  ] as const)("%s revierte la transaccion y deja el error en su campo, con lo enviado", async (_name, data, changes, field) => {
    const { calls, outcome } = await run(
      generate,
      { name: "C6", form: generateForm(changes), data: { ...data } },
      GENERATE_DATA,
    );

    expect(outcome.resultado).toMatchObject({ status: "error", values: { id_operario: "OPE00000003", periodo_inicio: "2026-11-02" } });
    expect(Object.keys((outcome.resultado as { fieldErrors?: Record<string, unknown> }).fieldErrors ?? {})).toEqual([field]);
    expect(effectIndex(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(prismaIndex(calls, "operacion_idempotente.updateMany")).toBe(-1);
  });
});
