import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { cancelPayrollAction, generatePayrollAction } from "@/modules/staff/payrolls/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
} from "@/testing/page-characterization";

// Caracterizacion de generar y anular planillas (C1 de la 11.5), escrita antes de tocar las
// acciones: hasta aqui no tenian ninguna prueba.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion, las lecturas (hoy
// fuera de la transaccion y sin bloquear ninguna fila), el correlativo, la escritura, la
// bitacora, el final de la transaccion, las revalidaciones y el resultado: la redireccion o el
// error exacto. Generar tambien escribe en la consola del servidor: el caso lo registra.

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
  action: (formData: FormData) => Promise<void>,
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
        await action(formData);

        return "termino sin redirigir";
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

const generateForm = (changes: Record<string, string> = {}) => ({
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
];

describe("generatePayrollAction", () => {
  for (const input of generateInputs) {
    it(input.name, async () => {
      const { calls, outcome } = await run(
        generatePayrollAction,
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
