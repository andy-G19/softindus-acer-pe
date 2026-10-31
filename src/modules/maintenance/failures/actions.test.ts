import { describe, expect, it, vi } from "vitest";

import type { RowStatusState } from "@/lib/requested-status";
import {
  createFailureAction,
  updateFailureStatusAction,
  type FailureFormState,
} from "@/modules/maintenance/failures/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de fallas (entrega 10.5b), escrita antes de
// corregir sus esquemas y sus decisiones fuera de la transaccion y de llevarlas
// al resultado de accion y al panel lateral. Cada caso ejecuta la accion real
// con Prisma, la sesion, la cache, la bitacora y los correlativos simulados, y
// fija en un snapshot, en orden: la autorizacion con sus roles, las lecturas,
// la transaccion con sus escrituras y su final, los correlativos, la bitacora,
// las revalidaciones y el resultado: la redireccion, el error que lanza o el
// estado que devuelve al formulario, con su mensaje exacto.
//
// Las dos bloquean la maquina o la falla y deciden dentro de la transaccion
// (B3, hallazgo 2 de la auditoria de la 10.5). Desde el panel lateral (B5), el
// alta autoriza con getAuthorizedSession (ADMIN y maestro de taller) y devuelve
// el resultado (FormActionState) en lugar de redirigir; niega el permiso con un
// error dentro del formulario. El cambio de estado (B7) devuelve su resultado a
// RowStatusSelect, y pedir el estado que ya tiene no escribe nada.

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

const MAQUINA = "MAQ00000003";
const FALLA = "FAL00000005";

const initialState: FailureFormState = { status: "idle" };
const create = (formData: FormData) => createFailureAction(initialState, formData);
const initialStatusState: RowStatusState = { status: "idle" };
const changeStatus = (formData: FormData) => updateFailureStatusAction(initialStatusState, formData);

const failWith = (error: Error) => () => {
  throw error;
};

const createForm: FormFields = {
  id_maquina: MAQUINA,
  fecha_falla: "2026-07-14T09:30",
  descripcion: "El husillo vibra al pasar de 800 rpm",
  responsable_registro: "Juan Quispe",
  estado_atencion: "pendiente",
  tiempo_perdido_horas: "2.5",
  impacto_produccion: "Se detuvo el torneado de bridas",
};

const emptyOptionals: FormFields = {
  responsable_registro: "",
  tiempo_perdido_horas: "",
  impacto_produccion: "",
};

const machine = (estado: string | null): DataOverrides => ({
  "maquina.findUnique": estado === null ? null : { id_maquina: MAQUINA, estado },
});

const failure = (estado_atencion: string | null): DataOverrides => ({
  "falla_maquina.findUnique": estado_atencion === null ? null : { id_falla: FALLA, estado_atencion },
});

const createWith = (fields: FormFields, data: DataOverrides = machine("operativa")) => ({
  form: { ...createForm, ...fields },
  data,
});

const statusWith = (estado_atencion: string, current: string | null = "pendiente") => ({
  form: { id_falla: FALLA, estado_atencion },
  data: failure(current),
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createFailureAction", create, [
  { name: "ADMIN registra la falla con su correlativo y la bitacora dentro de la transaccion", ...createWith({}) },
  {
    name: "WORKSHOP_MASTER tambien registra fallas",
    ...createWith({ estado_atencion: "en_atencion" }),
    role: "WORKSHOP_MASTER",
  },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...createWith({}), role: "SELLER" },
  { name: "los opcionales vacios se guardan como null", ...createWith(emptyOptionals) },
  {
    name: "los opcionales ausentes del formulario cuentan como vacios",
    ...createWith({ responsable_registro: null, tiempo_perdido_horas: null, impacto_produccion: null }),
  },
  {
    name: "datos invalidos devuelven los errores por campo sin tocar Prisma",
    ...createWith({ id_maquina: "MAQ1", descripcion: "mal", estado_atencion: "rota", tiempo_perdido_horas: "-1" }),
  },
  {
    name: "un POST sin campos devuelve los mensajes en espanol sin tocar Prisma",
    form: {},
  },
  { name: "un tiempo perdido que no es numero devuelve su error", ...createWith({ tiempo_perdido_horas: "dos" }) },
  {
    name: "un tiempo perdido que desborda su columna devuelve su error sin tocar Prisma",
    ...createWith({ tiempo_perdido_horas: "1e12" }),
  },
  { name: "una fecha que no es fecha devuelve su error", ...createWith({ fecha_falla: "mañana" }) },
  {
    name: "el 30 de febrero devuelve su error sin tocar Prisma",
    ...createWith({ fecha_falla: "2026-02-30T10:00" }),
  },
  { name: "la maquina no existe", ...createWith({}, machine(null)) },
  { name: "no registra fallas sobre una maquina inactiva", ...createWith({}, machine("inactiva")) },
  { name: "no registra fallas sobre una maquina dada de baja", ...createWith({}, machine("dada_de_baja")) },
  { name: "una maquina en reparacion admite otra falla", ...createWith({}, machine("en_reparacion")) },
  {
    name: "un fallo al crear revierte con el mensaje generico",
    ...createWith({}, { ...machine("operativa"), "falla_maquina.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("updateFailureStatusAction", changeStatus, [
  { name: "de pendiente a en atencion", ...statusWith("en_atencion") },
  { name: "de pendiente a reparada, sin reparacion", ...statusWith("reparada") },
  { name: "de pendiente a anulada", ...statusWith("anulada") },
  { name: "pedir el estado que ya tiene responde sin escribir nada", ...statusWith("pendiente") },
  { name: "de en atencion a pendiente", ...statusWith("pendiente", "en_atencion") },
  { name: "WORKSHOP_MASTER tambien cambia el estado", ...statusWith("en_atencion"), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...statusWith("en_atencion"), role: "SELLER" },
  { name: "una falla reparada no se modifica", ...statusWith("pendiente", "reparada") },
  { name: "una falla anulada no se modifica", ...statusWith("pendiente", "anulada") },
  { name: "la falla no existe", ...statusWith("en_atencion", null) },
  { name: "un estado que no existe devuelve su error sin tocar Prisma", ...statusWith("cerrada") },
  {
    name: "un fallo al escribir revierte con el mensaje generico",
    form: statusWith("en_atencion").form,
    data: { ...failure("pendiente"), "falla_maquina.update": failWith(new Error("conexion perdida")) },
  },

  { name: "un POST sin campos devuelve los mensajes en espanol sin tocar Prisma", form: {} },
]);

// Lo que la accion escribe, fuera del snapshot: el estado pedido y la fecha
// tal como la deja el esquema.
describe("createFailureAction escribe lo que recibe", () => {
  type Recorded = { prisma?: string; args?: { data?: Record<string, unknown> } };

  async function created(fields: FormFields) {
    const { calls } = await runCase(create, createWith(fields));
    const write = (calls as Recorded[]).find((call) => call.prisma === "falla_maquina.create");

    return write?.args?.data;
  }

  it("la fecha y hora del formulario se leen en la zona del servidor", async () => {
    expect((await created({}))?.fecha_falla).toEqual(new Date("2026-07-14T09:30:00.000Z"));
  });

  it("el 30 de febrero no llega a la base", async () => {
    expect(await created({ fecha_falla: "2026-02-30T10:00" })).toBeUndefined();
  });
});

// B3 (hallazgo 2): la fila se bloquea antes de leer lo que decide, tanto si la
// operacion sigue como si la rechaza.
describe("las acciones de fallas deciden con la fila bloqueada", () => {
  it.each([
    ["operativa", "acepta"],
    ["inactiva", "rechaza"],
  ])("el alta bloquea la maquina antes de leerla (%s: %s)", async (estado) => {
    const { calls } = await runCase(create, createWith({}, machine(estado)));

    expectRowLockedBefore(calls, {
      table: "maquina",
      id: MAQUINA,
      reads: (call) => call.prisma === "maquina.findUnique",
    });
  });

  it.each([
    ["pendiente", "acepta"],
    ["reparada", "rechaza"],
  ])("el cambio de estado bloquea la falla antes de leerla (%s: %s)", async (estado) => {
    const { calls } = await runCase(changeStatus, statusWith("en_atencion", estado));

    expectRowLockedBefore(calls, {
      table: "falla_maquina",
      id: FALLA,
      reads: (call) => call.prisma === "falla_maquina.findUnique",
    });
  });
});

// El resultado del alta, fuera del snapshot: lo que usa el formulario.
describe("createFailureAction devuelve el resultado al formulario", () => {
  async function result(actionCase: Omit<ActionCase, "name">) {
    const { result: outcome } = await runCase(create, actionCase);

    return (outcome as { estado: FailureFormState }).estado;
  }

  it("con exito devuelve el id y no redirige", async () => {
    expect(await result(createWith({}))).toMatchObject({ status: "success", data: { id_falla: "FAL00000012" } });
  });

  it.each([
    ["inactiva", "No se puede registrar una falla sobre una maquina inactiva."],
    [null, "La máquina seleccionada no existe."],
  ])("una maquina %s deja el error junto al campo y conserva lo escrito", async (estado, message) => {
    expect(await result(createWith({}, machine(estado)))).toMatchObject({
      status: "error",
      error: message,
      fieldErrors: { id_maquina: [message] },
      values: { descripcion: createForm.descripcion, id_maquina: MAQUINA },
    });
  });

  it("sin permiso responde con un error dentro del formulario", async () => {
    expect(await result({ ...createWith({}), role: "SELLER" })).toMatchObject({
      status: "error",
      error: "No tienes permisos para registrar fallas.",
    });
  });
});

describe("updateFailureStatusAction devuelve el resultado a la fila", () => {
  type Recorded = { prisma?: string; effect?: string };

  async function run(actionCase: Omit<ActionCase, "name">) {
    const { calls, result } = await runCase(changeStatus, actionCase);

    return { calls: calls as Recorded[], state: (result as { estado: RowStatusState }).estado };
  }

  it("con exito devuelve el estado que quedo y no redirige", async () => {
    const { state } = await run(statusWith("en_atencion"));

    expect(state).toMatchObject({ status: "success", data: { estado: "en_atencion" }, values: { id: FALLA } });
  });

  it("pedir el estado que ya tiene no escribe ni registra bitacora", async () => {
    const { calls, state } = await run(statusWith("pendiente"));

    expect(state).toMatchObject({ status: "error", error: "La falla ya estaba en ese estado." });
    expect(calls.filter((call) => call.prisma === "falla_maquina.update")).toEqual([]);
    expect(calls.filter((call) => call.effect === "registerAuditLog")).toEqual([]);
    expect(calls.filter((call) => call.effect === "revalidatePath")).toEqual([]);
  });

  it("una falla cerrada responde con su mensaje", async () => {
    const { state } = await run(statusWith("en_atencion", "anulada"));

    expect(state).toMatchObject({ status: "error", error: "No se puede modificar una falla cerrada o anulada." });
  });
});
