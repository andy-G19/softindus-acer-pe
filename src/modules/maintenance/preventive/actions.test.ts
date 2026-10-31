import { describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import {
  createPreventiveMaintenanceAction,
  updatePreventiveMaintenanceStatusAction,
  type PreventiveFormState,
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
// la bitacora, las revalidaciones y el resultado: la redireccion, el error que
// lanza o el estado que devuelve al formulario, con su mensaje exacto.
//
// Las dos autorizan solo a ADMIN. Desde el panel lateral (B6), el alta autoriza
// con getAuthorizedSession y devuelve el resultado (FormActionState) en lugar
// de redirigir; niega el permiso con un error dentro del formulario. Solo
// comprueba que la maquina exista, fuera de la transaccion: las maquinas no se
// borran, asi que no hay carrera que proteger, y acepta una maquina inactiva
// (hallazgo 12: se registra, no se cambia). El cambio de estado bloquea el
// mantenimiento y decide dentro de la transaccion (B3, hallazgo 2 de la
// auditoria de la 10.5), devuelve su resultado a RowStatusSelect (B7) y pedir el
// estado que ya tiene no escribe nada.

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

const initialState: PreventiveFormState = { status: "idle" };
const create = (formData: FormData) => createPreventiveMaintenanceAction(initialState, formData);
const initialStatusState: RowStatusState = { status: "idle" };
const changeStatus = (formData: FormData) => updatePreventiveMaintenanceStatusAction(initialStatusState, formData);

const failWith = (error: Error) => () => {
  throw error;
};

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

defineCases("createPreventiveMaintenanceAction", create, [
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
  { name: "WORKSHOP_MASTER: sin permiso responde con un error, sin tocar Prisma", ...createWith({}), role: "WORKSHOP_MASTER" },
  {
    name: "datos invalidos devuelven los errores por campo sin tocar Prisma",
    ...createWith({ id_maquina: "", fecha_programada: "", actividad: "rev", estado: "hecho" }),
  },
  { name: "un POST sin campos devuelve los mensajes en espanol sin tocar Prisma", form: {} },
  { name: "la maquina no existe", ...createWith({}, machine(false)) },
  {
    name: "el 30 de febrero devuelve su error sin tocar Prisma",
    ...createWith({ fecha_programada: "2026-02-30" }),
  },
  {
    name: "una fecha que no es fecha devuelve su error sin tocar Prisma",
    ...createWith({ fecha_programada: "mañana" }),
  },
  {
    name: "un fallo al crear revierte con el mensaje generico",
    ...createWith({}, { ...machine(), "mantenimiento_preventivo.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("updatePreventiveMaintenanceStatusAction", changeStatus, [
  { name: "de pendiente a realizado: la fecha realizada es el momento del cambio", ...statusWith("realizado") },
  { name: "de pendiente a vencido", ...statusWith("vencido") },
  { name: "de pendiente a anulado", ...statusWith("anulado") },
  { name: "de vencido a pendiente", ...statusWith("pendiente", "vencido") },
  { name: "pedir el estado que ya tiene responde sin escribir nada", ...statusWith("pendiente") },
  { name: "WORKSHOP_MASTER: sin permiso responde con un error, sin tocar Prisma", ...statusWith("realizado"), role: "WORKSHOP_MASTER" },
  { name: "un mantenimiento realizado no se modifica", ...statusWith("pendiente", "realizado") },
  { name: "un mantenimiento anulado no se modifica", ...statusWith("pendiente", "anulado") },
  { name: "el mantenimiento no existe", ...statusWith("realizado", null) },
  { name: "un estado que no existe devuelve su error sin tocar Prisma", ...statusWith("hecho") },
  {
    name: "un fallo al escribir revierte con el mensaje generico",
    form: statusWith("anulado").form,
    data: { ...maintenance("pendiente"), "mantenimiento_preventivo.update": failWith(new Error("conexion perdida")) },
  },

  { name: "un POST sin campos devuelve los mensajes en espanol sin tocar Prisma", form: {} },
]);

// Las fechas que se escriben, fuera del snapshot.
describe("las fechas del mantenimiento preventivo", () => {
  type Recorded = { prisma?: string; args?: { data?: Record<string, unknown> } };

  async function written(run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">, key: string) {
    const { calls } = await runCase(run, actionCase);

    return (calls as Recorded[]).find((call) => call.prisma === key)?.args?.data;
  }

  const createdWith = (fields: FormFields) =>
    written(create, createWith(fields), "mantenimiento_preventivo.create");

  it("la fecha programada es la medianoche del dia en la zona del servidor", async () => {
    expect((await createdWith({}))?.fecha_programada).toEqual(new Date("2026-07-20T00:00:00.000Z"));
  });

  it("una fecha que no existe o un texto no llegan a la base", async () => {
    expect(await createdWith({ fecha_programada: "2026-02-30" })).toBeUndefined();
    expect(await createdWith({ fecha_programada: "mañana" })).toBeUndefined();
  });

  it("marcar realizado guarda el momento del cambio; los demas estados la dejan vacia", async () => {
    const run = changeStatus;
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
    const { calls } = await runCase(changeStatus, statusWith("anulado", estado));

    expectRowLockedBefore(calls, {
      table: "mantenimiento_preventivo",
      id: MANTENIMIENTO,
      reads: (call) => call.prisma === "mantenimiento_preventivo.findUnique",
    });
  });
});

// El resultado del alta, fuera del snapshot: lo que usa el formulario.
describe("createPreventiveMaintenanceAction devuelve el resultado al formulario", () => {
  async function result(actionCase: Omit<ActionCase, "name">) {
    const { result: outcome } = await runCase(create, actionCase);

    return (outcome as { estado: PreventiveFormState }).estado;
  }

  it("con exito devuelve el id y no redirige", async () => {
    expect(await result(createWith({}))).toMatchObject({
      status: "success",
      data: { id_mantenimiento: "MTP00000007" },
    });
  });

  it("una maquina que no existe deja el error junto al campo y conserva lo escrito", async () => {
    expect(await result(createWith({}, machine(false)))).toMatchObject({
      status: "error",
      error: "La máquina seleccionada no existe.",
      fieldErrors: { id_maquina: ["La máquina seleccionada no existe."] },
      values: { actividad: createForm.actividad, id_maquina: MAQUINA },
    });
  });

  it("sin permiso responde con un error dentro del formulario", async () => {
    expect(await result({ ...createWith({}), role: "WORKSHOP_MASTER" })).toMatchObject({
      status: "error",
      error: "No tienes permisos para programar mantenimientos.",
    });
  });
});

describe("updatePreventiveMaintenanceStatusAction devuelve el resultado a la fila", () => {
  type Recorded = { prisma?: string; effect?: string };

  async function run(actionCase: Omit<ActionCase, "name">) {
    const { calls, result } = await runCase(changeStatus, actionCase);

    return { calls: calls as Recorded[], state: (result as { estado: RowStatusState }).estado };
  }

  it("con exito devuelve el estado que quedo y no redirige", async () => {
    const { state } = await run(statusWith("vencido"));

    expect(state).toMatchObject({ status: "success", data: { estado: "vencido" }, values: { id: MANTENIMIENTO } });
  });

  it("pedir el estado que ya tiene no escribe ni registra bitacora", async () => {
    const { calls, state } = await run(statusWith("pendiente"));

    expect(state).toMatchObject({ status: "error", error: "El mantenimiento ya estaba en ese estado." });
    expect(calls.filter((call) => call.prisma === "mantenimiento_preventivo.update")).toEqual([]);
    expect(calls.filter((call) => call.effect === "registerAuditLog")).toEqual([]);
  });

  it("uno realizado responde con su mensaje", async () => {
    const { state } = await run(statusWith("anulado", "realizado"));

    expect(state).toMatchObject({
      status: "error",
      error: "No se puede modificar un mantenimiento realizado o anulado.",
    });
  });
});
