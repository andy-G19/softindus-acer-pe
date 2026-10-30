import { describe, expect, it, vi } from "vitest";

import {
  createPreventiveMaintenanceAction,
  updatePreventiveMaintenanceStatusAction,
} from "@/modules/maintenance/preventive/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  FIXED_NOW,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de mantenimientos preventivos (entrega
// 10.5b), escrita antes de corregir sus esquemas y sus decisiones fuera de la
// transaccion y de llevarlas al resultado de accion y al panel lateral. Cada
// caso fija en un snapshot, en orden: la autorizacion con sus roles, las
// lecturas, la transaccion con sus escrituras y su final, los correlativos,
// la bitacora, las revalidaciones y el resultado: la redireccion o el error
// que lanza, con su mensaje exacto.
//
// Hoy las dos acciones reciben solo el FormData, autorizan solo a ADMIN con
// requireRole, lanzan un Error con los mensajes de Zod unidos y redirigen con
// su toast al terminar. El cambio de estado bloquea el mantenimiento y decide
// dentro de la transaccion (B3, hallazgo 2 de la auditoria de la 10.5). El alta
// solo comprueba que la maquina exista, fuera de la transaccion: las maquinas
// no se borran, asi que no hay carrera que proteger, y acepta una maquina
// inactiva (hallazgo 12: se registra, no se cambia).

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
    getNextCorrelativeId: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string },
    ) => {
      recordEffect("getNextCorrelativeId", params);
      const next = (mocks.correlatives.get(params.prefijo) ?? 6) + 1;
      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
  };
});

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

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

async function runCase(run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">) {
  mocks.correlatives.clear();

  return characterizeHandler(
    async () => {
      try {
        return { estado: await run(formOf(actionCase.form)) };
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    actionCase.data,
    { role: actionCase.role },
  );
}

function defineCases(name: string, run: (formData: FormData) => Promise<unknown>, cases: ActionCase[]) {
  describe(name, () => {
    for (const actionCase of cases) {
      it(actionCase.name, async () => {
        const { calls, result } = await runCase(run, actionCase);

        expectAuthorizesBeforePrisma(calls);
        expect(calls).toMatchSnapshot("llamadas");
        expect(result).toMatchSnapshot("resultado");
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const MAQUINA = "MAQ00000002";
const MANTENIMIENTO = "MTP00000004";

const createForm: FormFields = {
  id_maquina: MAQUINA,
  fecha_programada: "2026-07-20",
  responsable: "Rosa Huaman",
  actividad: "Cambio de aceite y filtros",
  estado: "pendiente",
  observaciones: "Usar aceite ISO 68",
};

// El alta solo comprueba que la maquina exista: no lee su estado.
const machine = (exists = true): DataOverrides => ({
  "maquina.findUnique": exists ? { id_maquina: MAQUINA } : null,
});

const maintenance = (estado: string | null): DataOverrides => ({
  "mantenimiento_preventivo.findUnique":
    estado === null
      ? null
      : { id_mantenimiento: MANTENIMIENTO, fecha_programada: new Date("2026-07-10T00:00:00.000Z"), estado },
});

const createWith = (fields: FormFields, data: DataOverrides = machine()) => ({
  form: { ...createForm, ...fields },
  data,
});

const statusWith = (estado: string, current: string | null = "pendiente") => ({
  form: { id_mantenimiento: MANTENIMIENTO, estado },
  data: maintenance(current),
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createPreventiveMaintenanceAction", createPreventiveMaintenanceAction, [
  { name: "programa el mantenimiento con su correlativo y la bitacora dentro de la transaccion", ...createWith({}) },
  { name: "realizado al crear copia la fecha programada como realizada", ...createWith({ estado: "realizado" }) },
  { name: "vencido al crear no tiene fecha realizada", ...createWith({ estado: "vencido" }) },
  { name: "anulado al crear no tiene fecha realizada", ...createWith({ estado: "anulado" }) },
  {
    name: "los opcionales vacios se guardan como null",
    ...createWith({ responsable: "", observaciones: "" }),
  },
  {
    name: "los opcionales ausentes del formulario cuentan como vacios",
    ...createWith({ responsable: null, observaciones: null }),
  },
  { name: "WORKSHOP_MASTER: sin permiso, sin tocar Prisma", ...createWith({}), role: "WORKSHOP_MASTER" },
  {
    name: "datos invalidos lanzan los mensajes unidos sin tocar Prisma",
    ...createWith({ id_maquina: "", fecha_programada: "", actividad: "rev", estado: "hecho" }),
  },
  { name: "un POST sin campos lanza los mensajes de Zod sin tocar Prisma", form: {} },
  { name: "la maquina no existe", ...createWith({}, machine(false)) },
  {
    name: "el 30 de febrero pasa el esquema y se guarda como el 2 de marzo",
    ...createWith({ fecha_programada: "2026-02-30" }),
  },
  {
    name: "una fecha que no es fecha pasa el esquema y llega a la base como fecha invalida",
    ...createWith({ fecha_programada: "mañana" }),
  },
]);

defineCases("updatePreventiveMaintenanceStatusAction", updatePreventiveMaintenanceStatusAction, [
  { name: "de pendiente a realizado: la fecha realizada es el momento del cambio", ...statusWith("realizado") },
  { name: "de pendiente a vencido", ...statusWith("vencido") },
  { name: "de pendiente a anulado", ...statusWith("anulado") },
  { name: "de vencido a pendiente", ...statusWith("pendiente", "vencido") },
  { name: "pedir el estado que ya tiene vuelve a escribirlo", ...statusWith("pendiente") },
  { name: "WORKSHOP_MASTER: sin permiso, sin tocar Prisma", ...statusWith("realizado"), role: "WORKSHOP_MASTER" },
  { name: "un mantenimiento realizado no se modifica", ...statusWith("pendiente", "realizado") },
  { name: "un mantenimiento anulado no se modifica", ...statusWith("pendiente", "anulado") },
  { name: "el mantenimiento no existe", ...statusWith("realizado", null) },
  { name: "un estado que no existe lanza su mensaje sin tocar Prisma", ...statusWith("hecho") },
  { name: "un POST sin campos lanza los mensajes de Zod sin tocar Prisma", form: {} },
]);

// Las fechas que se escriben, fuera del snapshot.
describe("las fechas del mantenimiento preventivo", () => {
  type Recorded = { prisma?: string; args?: { data?: Record<string, unknown> } };

  async function written(run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">, key: string) {
    const { calls } = await runCase(run, actionCase);

    return (calls as Recorded[]).find((call) => call.prisma === key)?.args?.data;
  }

  const create = (fields: FormFields) =>
    written(createPreventiveMaintenanceAction, createWith(fields), "mantenimiento_preventivo.create");

  it("la fecha programada es la medianoche del dia en la zona del servidor", async () => {
    expect((await create({}))?.fecha_programada).toEqual(new Date("2026-07-20T00:00:00.000Z"));
  });

  it("hoy el 30 de febrero se convierte en el 2 de marzo", async () => {
    expect((await create({ fecha_programada: "2026-02-30" }))?.fecha_programada).toEqual(
      new Date("2026-03-02T00:00:00.000Z"),
    );
  });

  it("hoy un texto llega a la base como fecha invalida", async () => {
    const data = await create({ fecha_programada: "mañana" });

    expect(Number.isNaN((data?.fecha_programada as Date).getTime())).toBe(true);
  });

  it("marcar realizado guarda el momento del cambio; los demas estados la dejan vacia", async () => {
    const run = updatePreventiveMaintenanceStatusAction;
    const key = "mantenimiento_preventivo.update";

    expect((await written(run, statusWith("realizado"), key))?.fecha_realizada).toEqual(FIXED_NOW);
    expect((await written(run, statusWith("vencido"), key))?.fecha_realizada).toBeNull();
    expect((await written(run, statusWith("pendiente", "vencido"), key))?.fecha_realizada).toBeNull();
  });
});

// B3 (hallazgo 2): la fila se bloquea antes de leer lo que decide, tanto si la
// operacion sigue como si la rechaza.
describe("el cambio de estado decide con la fila bloqueada", () => {
  it.each([
    ["pendiente", "acepta"],
    ["realizado", "rechaza"],
  ])("bloquea el mantenimiento antes de leerlo (%s: %s)", async (estado) => {
    const { calls } = await runCase(updatePreventiveMaintenanceStatusAction, statusWith("anulado", estado));

    expectRowLockedBefore(calls, {
      table: "mantenimiento_preventivo",
      id: MANTENIMIENTO,
      reads: (call) => call.prisma === "mantenimiento_preventivo.findUnique",
    });
  });
});
