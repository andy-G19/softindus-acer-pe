import { describe, expect, it, vi } from "vitest";

import { createReusableScrapAction } from "@/modules/waste-scrap/reusable-scraps/actions";
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
// lateral. Hoy el cambio de estado lee y escribe sin compare-and-set y no deja
// bitacora: el snapshot lo fija y cambia a proposito en su commit fix.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock({
    transactions: true,
    recordTransactionEnd: true,
    // El cambio de estado de hoy escribe con el cliente global, sin transaccion.
    writesOutsideTransaction: true,
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

const statusWith = (estadoActual: string | null, estado: string | null = "reutilizado") => ({
  form: { id_retazo: RETAZO, estado },
  data: {
    "retazo_reutilizable.findUnique": estadoActual === null ? null : { id_retazo: RETAZO, estado: estadoActual },
  } satisfies DataOverrides,
});

defineCases("createReusableScrapAction", createReusableScrapAction, [
  { name: "ADMIN registra el retazo disponible con el tipo de la categoria del material", ...scrapWith() },
  { name: "WORKSHOP_MASTER tambien registra retazos", ...scrapWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede registrar", ...scrapWith(), role: "SELLER" },
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
]);

defineCases("updateReusableScrapStatusAction", updateReusableScrapStatusAction, [
  { name: "un retazo disponible pasa a reutilizado, sin bitacora ni aviso", ...statusWith("disponible") },
  { name: "un retazo disponible pasa a descartado", ...statusWith("disponible", "descartado") },
  { name: "WORKSHOP_MASTER tambien cambia el estado", ...statusWith("disponible"), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede cambiar el estado", ...statusWith("disponible"), role: "SELLER" },
  { name: "sin id se rechaza sin tocar Prisma", form: { id_retazo: "", estado: "reutilizado" } },
  { name: "disponible no es un estado de destino", ...statusWith("disponible", "disponible") },
  { name: "sin estado se rechaza", ...statusWith("disponible", null) },
  { name: "el retazo no existe", ...statusWith(null) },
  { name: "un retazo reutilizado ya no cambia", ...statusWith("reutilizado", "descartado") },
  { name: "un retazo descartado ya no cambia", ...statusWith("descartado", "reutilizado") },
]);

// La orden se bloquea antes de leerla (hallazgo 12 de la 10.7): anularla a la vez ya no
// deja un registro colgado de una orden anulada.
describe("las decisiones se toman con la orden bloqueada", () => {
  const ORDEN = "OTR00000003";

  it("bloquea la orden antes de leer lo que decide", async () => {
    const { calls } = await runCase(createReusableScrapAction, scrapWith());

    expectRowLockedBefore(calls, {
      table: "orden_trabajo",
      id: ORDEN,
      reads: (call) => call.prisma === "orden_trabajo.findUnique" || call.prisma === "material.findUnique",
    });
  });

  it("el correlativo se reserva despues del bloqueo", async () => {
    const { calls } = await runCase(createReusableScrapAction, scrapWith());
    const lock = calls.findIndex((call) => isRowLock(call, "orden_trabajo", ORDEN));
    const correlative = calls.findIndex((call) => "effect" in call && call.effect === "getNextCorrelativeId");

    expect(lock).toBeGreaterThanOrEqual(0);
    expect(correlative).toBeGreaterThan(lock);
  });
});
