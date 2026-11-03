import { describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import { createReusableScrapAction, type ReusableScrapFormState } from "@/modules/waste-scrap/reusable-scraps/actions";
import { updateReusableScrapStatusAction } from "@/modules/waste-scrap/reusable-scraps/status-actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isRowLock,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion del alta y del cambio de estado de retazos (entrega 10.7a),
// escrita antes de llevarlos al bloqueo de fila, al resultado de accion y al panel
// lateral. Desde A10 el cambio de estado es un compare-and-set y deja bitacora. Desde
// A12 las dos acciones devuelven su resultado: sin permiso responden con un error.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
// Cada respuesta lleva un operationId aleatorio; en los snapshots, uno fijo.
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
    getNextCorrelativeId: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string },
    ) => {
      recordEffect("getNextCorrelativeId", params);
      const next = (mocks.correlatives.get(params.prefijo) ?? 11) + 1;
      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
  };
});

// null deja el campo fuera del formulario: formData.get devuelve null.
type FormFields = Record<string, string | null>;
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) {
      formData.append(key, value);
    }
  }

  return formData;
}

async function runCase(run: (formData: FormData) => Promise<unknown>, { form, data, role }: Omit<ActionCase, "name">) {
  mocks.correlatives.clear();

  return characterizeHandler(
    async () => {
      try {
        return { estado: await run(formOf(form)) };
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    data,
    { role },
  );
}

function defineCases(name: string, run: (formData: FormData) => Promise<unknown>, cases: ActionCase[]) {
  describe(name, () => {
    for (const { name: caseName, ...actionCase } of cases) {
      it(caseName, async () => {
        const { calls, result } = await runCase(run, actionCase);

        expectAuthorizesBeforePrisma(calls);
        expect(calls).toMatchSnapshot("llamadas");
        expect(result).toMatchSnapshot("resultado");
      });
    }
  });
}

const RETAZO = "RET00000003";

const initialState: ReusableScrapFormState = { status: "idle" };
const create = (formData: FormData) => createReusableScrapAction(initialState, formData);
const initialStatusState: RowStatusState = { status: "idle" };
const changeStatus = (formData: FormData) => updateReusableScrapStatusAction(initialStatusState, formData);

const form: FormFields = {
  id_material: "MAT00000002",
  id_orden_trabajo: "OTR00000003",
  medida_aproximada: "30 cm x 15 cm",
  cantidad: "2",
  unidad_medida: "pieza",
  ubicacion: "Estante A",
};

const material = (estado: boolean | null): DataOverrides => ({
  "material.findUnique":
    estado === null
      ? null
      : {
          id_material: "MAT00000002",
          nombre_material: "Plancha",
          categoria: "planchas",
          unidad_medida: "pieza",
          estado,
        },
});

const workOrder = (estado: string | null): DataOverrides => ({
  "orden_trabajo.findUnique": estado === null ? null : { id_orden_trabajo: "OTR00000003", estado },
});

const scrapWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...form, ...fields },
  data: { ...material(true), ...workOrder("en_proceso"), ...data },
});

// El where del compare-and-set exige disponible: otro estado no devuelve ninguna fila.
const statusWith = (estadoActual: string | null, estado: string | null = "reutilizado") => ({
  form: { id_retazo: RETAZO, estado },
  data: {
    "retazo_reutilizable.updateManyAndReturn": estadoActual === "disponible" ? [{ id_retazo: RETAZO }] : [],
    "retazo_reutilizable.findUnique": estadoActual === null ? null : { id_retazo: RETAZO },
  } satisfies DataOverrides,
});

defineCases("createReusableScrapAction", create, [
  { name: "ADMIN registra el retazo disponible con el tipo de la categoria del material", ...scrapWith() },
  { name: "WORKSHOP_MASTER tambien registra retazos", ...scrapWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...scrapWith(), role: "SELLER" },
  { name: "medida y ubicacion vacias se guardan como null", ...scrapWith({ medida_aproximada: "", ubicacion: "" }) },
  { name: "sin material se rechaza", ...scrapWith({ id_material: "" }) },
  { name: "sin orden se rechaza", ...scrapWith({ id_orden_trabajo: "" }) },
  { name: "la cantidad cero se rechaza", ...scrapWith({ cantidad: "0" }) },
  { name: "la cantidad no numerica se rechaza", ...scrapWith({ cantidad: "abc" }) },
  { name: "una cantidad de 0.001 se rechaza porque se guardaria como cero", ...scrapWith({ cantidad: "0.001" }) },
  { name: "sin unidad se rechaza", ...scrapWith({ unidad_medida: "" }) },
  { name: "la medida no supera 80 caracteres", ...scrapWith({ medida_aproximada: "x".repeat(81) }) },
  { name: "la ubicacion no supera 100 caracteres", ...scrapWith({ ubicacion: "x".repeat(101) }) },
  { name: "el material no existe", ...scrapWith({}, material(null)) },
  { name: "el material esta inactivo", ...scrapWith({}, material(false)) },
  { name: "la orden no existe", ...scrapWith({}, workOrder(null)) },
  { name: "la orden esta anulada", ...scrapWith({}, workOrder("anulada")) },
  { name: "una orden finalizada se admite", ...scrapWith({}, workOrder("finalizada")) },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
  {
    name: "un fallo al crear revierte con el mensaje generico",
    ...scrapWith({}, { "retazo_reutilizable.create": () => { throw new Error("conexion perdida"); } }),
  },
]);

defineCases("updateReusableScrapStatusAction", changeStatus, [
  { name: "un retazo disponible pasa a reutilizado y deja bitacora", ...statusWith("disponible") },
  { name: "un retazo disponible pasa a descartado", ...statusWith("disponible", "descartado") },
  { name: "WORKSHOP_MASTER tambien cambia el estado", ...statusWith("disponible"), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...statusWith("disponible"), role: "SELLER" },
  { name: "sin id se rechaza sin tocar Prisma", form: { id_retazo: "", estado: "reutilizado" } },
  { name: "disponible no es un estado de destino", ...statusWith("disponible", "disponible") },
  { name: "sin estado se rechaza", ...statusWith("disponible", null) },
  { name: "el retazo no existe", ...statusWith(null) },
  { name: "un retazo reutilizado ya no cambia", ...statusWith("reutilizado", "descartado") },
  { name: "un retazo descartado ya no cambia", ...statusWith("descartado", "reutilizado") },
  {
    name: "un fallo al escribir revierte con el mensaje generico",
    form: { id_retazo: RETAZO, estado: "reutilizado" },
    data: {
      "retazo_reutilizable.updateManyAndReturn": () => {
        throw new Error("conexion perdida");
      },
    },
  },
]);

// La orden se bloquea antes de leerla (hallazgo 12 de la 10.7): anularla a la vez ya no
// deja un registro colgado de una orden anulada.
describe("las decisiones se toman con la orden bloqueada", () => {
  const ORDEN = "OTR00000003";

  it("bloquea la orden antes de leer lo que decide", async () => {
    const { calls } = await runCase(create, scrapWith());

    expectRowLockedBefore(calls, {
      table: "orden_trabajo",
      id: ORDEN,
      reads: (call) => call.prisma === "orden_trabajo.findUnique" || call.prisma === "material.findUnique",
    });
  });

  it("el correlativo se reserva despues del bloqueo", async () => {
    const { calls } = await runCase(create, scrapWith());
    const lock = calls.findIndex((call) => isRowLock(call, "orden_trabajo", ORDEN));
    const correlative = calls.findIndex((call) => "effect" in call && call.effect === "getNextCorrelativeId");

    expect(lock).toBeGreaterThanOrEqual(0);
    expect(correlative).toBeGreaterThan(lock);
  });
});

// Hallazgo 13 de la 10.7: el cambio de estado leia y escribia aparte, y sin bitacora.
describe("el estado del retazo se fija con una sola sentencia", () => {
  type Recorded = { prisma?: string; effect?: string; args?: { where?: unknown; data?: unknown; accion?: unknown } };

  it("solo escribe si sigue disponible, sin leer antes", async () => {
    const { calls } = await runCase(changeStatus, statusWith("disponible", "descartado"));
    const recorded = calls as Recorded[];
    const write = recorded.find((call) => call.prisma === "retazo_reutilizable.updateManyAndReturn");

    expect(write?.args?.where).toEqual({ id_retazo: RETAZO, estado: "disponible" });
    expect(write?.args?.data).toEqual({ estado: "descartado" });
    expect(recorded.some((call) => call.prisma === "retazo_reutilizable.findUnique")).toBe(false);
  });

  it("deja la bitacora dentro de la transaccion, con quien lo hizo", async () => {
    const { calls } = await runCase(changeStatus, statusWith("disponible", "descartado"));
    const audit = (calls as Recorded[]).find((call) => call.effect === "registerAuditLog");

    expect(audit?.args).toEqual(
      expect.objectContaining({
        entidad_afectada: "retazo_reutilizable",
        id_registro_afectado: RETAZO,
        accion: "descartado",
        detalle: `Retazo descartado: ${RETAZO}.`,
        enTransaccion: true,
      }),
    );
  });

  it("si ya no estaba disponible no deja bitacora ni revalida", async () => {
    const { calls, result } = await runCase(changeStatus, statusWith("reutilizado", "descartado"));
    const recorded = calls as Recorded[];

    expect(result).toEqual({
      estado: expect.objectContaining({
        status: "error",
        error: "Solo se puede cambiar el estado de retazos disponibles.",
      }),
    });
    expect(recorded.some((call) => call.effect === "registerAuditLog")).toBe(false);
    expect(recorded.some((call) => call.effect === "revalidatePath")).toBe(false);
  });
});
