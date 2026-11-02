import { describe, expect, it, vi } from "vitest";

import { createScrapAction, type ScrapFormState } from "@/modules/waste-scrap/scraps/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isRowLock,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion del alta de chatarra (entrega 10.7a), escrita antes de llevarla
// al bloqueo de fila, al resultado de accion y al panel lateral. Fija en un
// snapshot, en orden: la autorizacion, las lecturas, la transaccion, el
// correlativo, la bitacora, las revalidaciones y el resultado. Desde el panel (A11)
// devuelve FormActionState: sin permiso responde con un error, sin redirigir.

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

const form: FormFields = {
  id_material: "MAT00000002",
  id_orden_trabajo: "OTR00000003",
  tipo_material: "Acero",
  peso_kg: "12.5",
  cantidad: "3",
  observaciones: "Corte de planchas",
};

const material = (estado: boolean | null): DataOverrides => ({
  "material.findUnique": estado === null ? null : { id_material: "MAT00000002", estado },
});

const workOrder = (estado: string | null): DataOverrides => ({
  "orden_trabajo.findUnique": estado === null ? null : { id_orden_trabajo: "OTR00000003", estado },
});

const scrapWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...form, ...fields },
  data: { ...material(true), ...workOrder("en_proceso"), ...data },
});

const initialState: ScrapFormState = { status: "idle" };
const create = (formData: FormData) => createScrapAction(initialState, formData);

async function runCase(run: (formData: FormData) => Promise<unknown>, { form: fields, data, role }: Omit<ActionCase, "name">) {
  mocks.correlatives.clear();

  return characterizeHandler(
    async () => {
      try {
        return { estado: await run(formOf(fields)) };
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

const CASES: ActionCase[] = [
  { name: "ADMIN registra la chatarra acumulada con la bitacora en la transaccion", ...scrapWith() },
  { name: "WORKSHOP_MASTER tambien registra chatarra", ...scrapWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...scrapWith(), role: "SELLER" },
  { name: "sin material ni orden no se leen", ...scrapWith({ id_material: "", id_orden_trabajo: "" }) },
  { name: "solo con peso", ...scrapWith({ cantidad: "" }) },
  { name: "solo con cantidad", ...scrapWith({ peso_kg: "" }) },
  { name: "sin peso ni cantidad se rechaza", ...scrapWith({ peso_kg: "", cantidad: "" }) },
  { name: "las observaciones vacias se guardan como null", ...scrapWith({ observaciones: "" }) },
  { name: "el tipo es obligatorio", ...scrapWith({ tipo_material: "" }) },
  { name: "el tipo no supera 50 caracteres", ...scrapWith({ tipo_material: "x".repeat(51) }) },
  { name: "el peso negativo se rechaza", ...scrapWith({ peso_kg: "-1" }) },
  { name: "el peso no numerico se rechaza", ...scrapWith({ peso_kg: "abc" }) },
  { name: "un peso de 0.001 se rechaza porque se guardaria como cero", ...scrapWith({ peso_kg: "0.001", cantidad: "" }) },
  { name: "el material no existe", ...scrapWith({}, material(null)) },
  { name: "el material esta inactivo", ...scrapWith({}, material(false)) },
  { name: "la orden no existe", ...scrapWith({}, workOrder(null)) },
  { name: "la orden esta anulada", ...scrapWith({}, workOrder("anulada")) },
  { name: "una orden finalizada se admite", ...scrapWith({}, workOrder("finalizada")) },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
  {
    name: "un fallo al crear revierte con el mensaje generico",
    ...scrapWith({}, { "chatarra.create": () => { throw new Error("conexion perdida"); } }),
  },
];

describe("createScrapAction", () => {
  for (const { name, ...actionCase } of CASES) {
    it(name, async () => {
      const { calls, result } = await runCase(create, actionCase);

      expectAuthorizesBeforePrisma(calls);
      expect(calls).toMatchSnapshot("llamadas");
      expect(result).toMatchSnapshot("resultado");
    });
  }
});

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

  it("sin orden no hay nada que bloquear y el material se lee en la transaccion", async () => {
    const { calls } = await runCase(create, scrapWith({ id_orden_trabajo: "" }));
    const begin = calls.findIndex((call) => "effect" in call && call.effect === "prisma.$transaction");
    const material = calls.findIndex((call) => "prisma" in call && call.prisma === "material.findUnique");

    expect(calls.some((call) => "prisma" in call && call.prisma === "$queryRaw")).toBe(false);
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(material).toBeGreaterThan(begin);
  });
});
