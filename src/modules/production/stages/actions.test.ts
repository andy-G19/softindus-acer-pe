import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import type { StatusToggleState } from "@/lib/requested-status";
import {
  createRouteStageAction,
  toggleRouteStageStatusAction,
  updateRouteStageAction,
  type RouteStageFormState,
} from "@/modules/production/stages/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isRowLock,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de etapas de ruta (entrega 10.6a), escrita
// antes de llevarlas al bloqueo de fila, al resultado de accion y al panel
// lateral. Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la
// bitacora y los correlativos simulados, y fija en un snapshot, en orden: la
// autorizacion con sus roles, las lecturas, la transaccion con sus escrituras y
// su final, los correlativos, la bitacora, las revalidaciones y el resultado.
//
// Desde el panel lateral (A5), el alta y la edicion autorizan con
// getAuthorizedSession y devuelven el resultado (FormActionState) en lugar de
// redirigir: sin permiso responden con un error dentro del formulario.

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

const RUTA = "RUT00000003";
const ETAPA = "ETA00000006";
const MAQUINA = "MAQ00000002";
const OTRA_MAQUINA = "MAQ00000008";

const initialState: RouteStageFormState = { status: "idle" };
const create = (formData: FormData) => createRouteStageAction(initialState, formData);
const update = (formData: FormData) => updateRouteStageAction(initialState, formData);

const failWith = (error: Error) => () => {
  throw error;
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

const form: FormFields = {
  id_ruta: RUTA,
  nombre_etapa: "Corte de plancha",
  orden_secuencia: "3",
  descripcion: "Corte segun medida base",
  tiempo_operario_minutos_unidad: "8",
  id_maquina: "",
  modo_tiempo: "simultaneo",
};

const withMachine: FormFields = {
  id_maquina: MAQUINA,
  tiempo_maquina_minutos_unidad: "6",
  requiere_maquina: null,
};

const route = (exists = true): DataOverrides => ({
  "ruta_fabricacion.findFirst": exists ? { id_ruta: RUTA, nombre_ruta: "Ruta de lampa" } : null,
});

// Un solo modelo responde a las dos comprobaciones de duplicado: la del nombre
// y la del orden se distinguen por su where.
const duplicated = (field: "nombre_etapa" | "orden_secuencia" | null): DataOverrides => ({
  "etapa_ruta.findFirst": (args) =>
    field !== null && (args as { where?: Record<string, unknown> }).where?.[field] !== undefined
      ? { id_etapa_ruta: "ETA00000009" }
      : null,
});

const machine = (estado: string | null, id = MAQUINA): DataOverrides => ({
  "maquina.findUnique": estado === null ? null : { id_maquina: id, nombre: "Plegadora", estado },
});

const noAssignments: DataOverrides = { "etapa_ruta_maquina.findMany": [] };

const currentStage = (assignedTo: string | null = null, idRuta = RUTA): DataOverrides => ({
  "etapa_ruta.findUnique": {
    id_etapa_ruta: ETAPA,
    id_ruta: idRuta,
    etapa_ruta_maquina: assignedTo ? [{ id_maquina: assignedTo }] : [],
  },
});

const assignments = (...ids: string[]): DataOverrides => ({
  "etapa_ruta_maquina.findMany": ids.map((id, index) => ({
    id_etapa_ruta_maquina: `ERM0000000${index + 1}`,
    id_maquina: id,
  })),
});

const createWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...form, ...fields },
  data: { ...route(), ...duplicated(null), ...noAssignments, ...data },
});

const updateWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...form, id_etapa_ruta: ETAPA, ...fields },
  data: { ...currentStage(), ...duplicated(null), ...noAssignments, ...data },
});

const initialToggleState: StatusToggleState = { status: "idle" };
const toggle = (formData: FormData) => toggleRouteStageStatusAction(initialToggleState, formData);

// El estado pedido, que el boton envia; la fila que devuelve la base lleva su ruta.
const toggleOf = (estado: boolean) => ({
  form: { id_etapa_ruta: ETAPA, estado: String(estado) },
  data: { "etapa_ruta.updateManyAndReturn": [{ id_ruta: RUTA }] } satisfies DataOverrides,
});

const alreadyThere = {
  form: { id_etapa_ruta: ETAPA, estado: "false" },
  data: {
    "etapa_ruta.updateManyAndReturn": [],
    "etapa_ruta.findUnique": { id_etapa_ruta: ETAPA },
  } satisfies DataOverrides,
};

const missing = {
  form: { id_etapa_ruta: ETAPA, estado: "false" },
  data: { "etapa_ruta.updateManyAndReturn": [], "etapa_ruta.findUnique": null } satisfies DataOverrides,
};

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createRouteStageAction", create, [
  { name: "ADMIN crea la etapa sin maquina", ...createWith() },
  { name: "WORKSHOP_MASTER tambien crea etapas", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...createWith(), role: "SELLER" },
  { name: "con maquina crea la asignacion y queda obligada", ...createWith(withMachine, machine("operativa")) },
  { name: "una maquina en reparacion se puede asignar", ...createWith(withMachine, machine("en_reparacion")) },
  { name: "una maquina inactiva no se puede asignar", ...createWith(withMachine, machine("inactiva")) },
  { name: "una maquina dada de baja no se puede asignar", ...createWith(withMachine, machine("dada_de_baja")) },
  { name: "la maquina no existe", ...createWith(withMachine, machine(null)) },
  { name: "sin maquina se puede marcar que la requiere", ...createWith({ requiere_maquina: "on" }) },
  {
    name: "los opcionales vacios se guardan como null",
    ...createWith({ descripcion: "", tiempo_operario_minutos_unidad: "" }),
  },
  { name: "sin modo de tiempo usa el simultaneo", ...createWith({ modo_tiempo: null }) },
  {
    name: "modo secuencial con maquina",
    ...createWith({ ...withMachine, modo_tiempo: "secuencial" }, machine("operativa")),
  },
  { name: "datos invalidos devuelven los errores por campo sin tocar Prisma", ...createWith({ nombre_etapa: "ab", orden_secuencia: "0" }) },
  { name: "un modo de tiempo que no existe devuelve su error", ...createWith({ modo_tiempo: "turbo" }) },
  { name: "un orden que no es numero devuelve su error", ...createWith({ orden_secuencia: "uno" }) },
  { name: "un orden con decimales devuelve su error", ...createWith({ orden_secuencia: "1.5" }) },
  { name: "minutos negativos devuelven su error", ...createWith({ tiempo_operario_minutos_unidad: "-1" }) },
  { name: "minutos que redondean a cero se rechazan", ...createWith({ tiempo_operario_minutos_unidad: "0.001" }) },
  { name: "minutos de maquina sin maquina devuelven su error", ...createWith({ tiempo_maquina_minutos_unidad: "5" }) },
  {
    name: "maquina sin minutos devuelve su error",
    ...createWith({ id_maquina: MAQUINA, tiempo_maquina_minutos_unidad: "" }),
  },
  { name: "un POST sin campos devuelve sus errores sin tocar Prisma", form: {} },
  { name: "la ruta no existe o esta inactiva", ...createWith({}, route(false)) },
  { name: "ya existe una etapa con ese nombre", ...createWith({}, duplicated("nombre_etapa")) },
  { name: "ya existe una etapa con ese orden", ...createWith({}, duplicated("orden_secuencia")) },
  {
    name: "un P2002, que el candado de la ruta ya evita, responde con el mensaje generico",
    ...createWith({}, { "etapa_ruta.create": failWith(uniqueViolation()) }),
  },
]);

defineCases("updateRouteStageAction", update, [
  { name: "ADMIN actualiza la etapa", ...updateWith() },
  { name: "WORKSHOP_MASTER tambien actualiza etapas", ...updateWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...updateWith(), role: "SELLER" },
  { name: "sin id devuelve su error sin tocar Prisma", ...updateWith({ id_etapa_ruta: "" }) },
  { name: "datos invalidos devuelven los errores por campo", ...updateWith({ nombre_etapa: "ab" }) },
  { name: "la etapa no existe", ...updateWith({}, { "etapa_ruta.findUnique": null }) },
  { name: "la etapa es de otra ruta", ...updateWith({}, currentStage(null, "RUT00000009")) },
  { name: "otra etapa ya usa ese nombre", ...updateWith({}, duplicated("nombre_etapa")) },
  { name: "otra etapa ya usa ese orden", ...updateWith({}, duplicated("orden_secuencia")) },
  {
    name: "asignar una maquina crea la asignacion",
    ...updateWith(withMachine, machine("operativa")),
  },
  {
    name: "conservar la maquina actualiza sus minutos aunque este de baja",
    ...updateWith(withMachine, {
      ...currentStage(MAQUINA),
      ...machine("dada_de_baja"),
      ...assignments(MAQUINA),
    }),
  },
  {
    name: "cambiar a otra maquina borra la anterior",
    ...updateWith(
      { ...withMachine, id_maquina: OTRA_MAQUINA },
      { ...currentStage(MAQUINA), ...machine("operativa", OTRA_MAQUINA), ...assignments(MAQUINA) },
    ),
  },
  {
    name: "cambiar a una maquina de baja se rechaza",
    ...updateWith(
      { ...withMachine, id_maquina: OTRA_MAQUINA },
      { ...currentStage(MAQUINA), ...machine("dada_de_baja", OTRA_MAQUINA) },
    ),
  },
  {
    name: "quitar la maquina borra la asignacion",
    ...updateWith({}, { ...currentStage(MAQUINA), ...assignments(MAQUINA) }),
  },
  {
    name: "un P2002, que el candado de la ruta ya evita, responde con el mensaje generico",
    ...updateWith({}, { "etapa_ruta.update": failWith(uniqueViolation()) }),
  },
]);

defineCases("toggleRouteStageStatusAction", toggle, [
  { name: "una etapa activa se inactiva", ...toggleOf(false) },
  { name: "una etapa inactiva se activa", ...toggleOf(true) },
  { name: "WORKSHOP_MASTER tambien cambia el estado", ...toggleOf(false), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...toggleOf(false), role: "SELLER" },
  { name: "sin id devuelve su error sin tocar Prisma", form: { estado: "false" } },
  { name: "sin estado pedido devuelve su error sin tocar Prisma", form: { id_etapa_ruta: ETAPA } },
  { name: "ya tenia ese estado", ...alreadyThere },
  { name: "la etapa no existe", ...missing },
]);

// Lo que el alta y la edicion escriben, fuera del snapshot.
describe("las acciones de etapas escriben lo que reciben", () => {
  type Recorded = { prisma?: string; args?: { data?: Record<string, unknown> } };

  async function written(run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">, model: string) {
    const { calls } = await runCase(run, actionCase);

    return (calls as Recorded[]).find((call) => call.prisma === model)?.args?.data;
  }

  it("con maquina la etapa queda obligada aunque el formulario no lo marque", async () => {
    const data = await written(create, createWith(withMachine, machine("operativa")), "etapa_ruta.create");

    expect(data).toMatchObject({ requiere_maquina: true, estado: true });
  });

  it("el tiempo de maquina vive en la asignacion", async () => {
    const data = await written(create, createWith(withMachine, machine("operativa")), "etapa_ruta_maquina.create");

    expect(data).toMatchObject({ id_maquina: MAQUINA, tiempo_maquina_minutos_unidad: 6 });
  });

  it("la edicion no mueve la etapa de ruta ni toca su estado", async () => {
    const data = await written(update, updateWith(), "etapa_ruta.update");

    expect(data).not.toHaveProperty("id_ruta");
    expect(data).not.toHaveProperty("estado");
  });
});

// A2 (hallazgo 1 de la auditoria de la 10.6): un solo candado por ruta pone en fila
// a quienes crean y editan sus etapas, asi que las comprobaciones de nombre y
// orden ya no compiten; la maquina se bloquea despues de la ruta.
describe("las acciones de etapas deciden con la ruta bloqueada", () => {
  const decides = (call: { prisma: string }) =>
    ["ruta_fabricacion.findFirst", "etapa_ruta.findFirst", "etapa_ruta.findUnique", "maquina.findUnique"].includes(call.prisma);

  it.each([
    ["acepta", createWith(withMachine, machine("operativa"))],
    ["rechaza la ruta", createWith({}, route(false))],
    ["rechaza el nombre", createWith({}, duplicated("nombre_etapa"))],
  ])("el alta bloquea la ruta antes de leer (%s)", async (_name, actionCase) => {
    const { calls } = await runCase(create, actionCase);

    expectRowLockedBefore(calls, { table: "ruta_fabricacion", id: RUTA, reads: decides });
  });

  it.each([
    ["acepta", updateWith(withMachine, machine("operativa"))],
    ["rechaza la etapa", updateWith({}, { "etapa_ruta.findUnique": null })],
    ["rechaza otra ruta", updateWith({}, currentStage(null, "RUT00000009"))],
  ])("la edicion bloquea la ruta antes de leer (%s)", async (_name, actionCase) => {
    const { calls } = await runCase(update, actionCase);

    expectRowLockedBefore(calls, { table: "ruta_fabricacion", id: RUTA, reads: decides });
  });

  it.each([
    ["alta", create, createWith(withMachine, machine("operativa"))],
    ["alta que rechaza", create, createWith(withMachine, machine("inactiva"))],
    ["edicion", update, updateWith(withMachine, machine("operativa"))],
  ])("la maquina se bloquea antes de leerla y despues de la ruta (%s)", async (_name, run, actionCase) => {
    const { calls } = await runCase(run, actionCase);

    expectRowLockedBefore(calls, {
      table: "maquina",
      id: MAQUINA,
      reads: (call) => call.prisma === "maquina.findUnique",
    });
    expect(calls.findIndex((call) => isRowLock(call, "ruta_fabricacion", RUTA))).toBeLessThan(
      calls.findIndex((call) => isRowLock(call, "maquina", MAQUINA)),
    );
  });

  it("sin maquina no se bloquea ninguna", async () => {
    const { calls } = await runCase(create, createWith());

    expect(calls.filter((call) => isRowLock(call, "maquina", MAQUINA))).toEqual([]);
  });
});

// A3 (hallazgo 10): ningun error de un formulario sale con el mensaje de Zod en
// ingles, y lo que la columna guardaria como cero no pasa por un dato valido.
describe("los mensajes de etapas estan en espanol", () => {
  type Errors = { estado: { fieldErrors: Record<string, string[]> } };

  // El snapshot del resultado ya no redirige: la accion devuelve el id.

  const errorsOf = async (actionCase: Omit<ActionCase, "name">) =>
    ((await runCase(create, actionCase)).result as Errors).estado.fieldErrors;

  it("un POST sin campos", async () => {
    const errors = await errorsOf({ form: {} });

    expect(errors).toEqual({
      id_ruta: ["La ruta de fabricación es obligatoria."],
      nombre_etapa: ["El nombre de la etapa debe tener al menos 3 caracteres."],
      orden_secuencia: ["El orden debe ser mayor o igual a 1."],
    });
  });

  it("un orden que no es numero", async () => {
    expect((await errorsOf(createWith({ orden_secuencia: "uno" }))).orden_secuencia).toEqual([
      "El orden debe ser un número entero.",
    ]);
  });

  it.each([
    ["operario", { tiempo_operario_minutos_unidad: "0.001" }, "tiempo_operario_minutos_unidad"],
    ["maquina", { id_maquina: MAQUINA, tiempo_maquina_minutos_unidad: "0.009" }, "tiempo_maquina_minutos_unidad"],
  ])("los minutos de %s que redondean a cero", async (_name, fields, field) => {
    expect((await errorsOf(createWith(fields)))[field]).toEqual(["El tiempo debe ser de al menos 0.01 minutos."]);
  });

  it("0.01 minutos si se acepta", async () => {
    const { result } = await runCase(create, createWith({ tiempo_operario_minutos_unidad: "0.01" }));

    expect(result).toMatchObject({ estado: { status: "success" } });
  });
});

// A5: el resultado llega al formulario con lo escrito, sin redirigir.
describe("el alta y la edicion de etapas devuelven el resultado al formulario", () => {
  const stateOf = async (run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">) =>
    ((await runCase(run, actionCase)).result as { estado: RouteStageFormState }).estado;

  it("con exito devuelve el id y no redirige", async () => {
    expect(await stateOf(create, createWith())).toMatchObject({
      status: "success",
      data: { id_etapa_ruta: "ETA00000012" },
    });
    expect(await stateOf(update, updateWith())).toMatchObject({
      status: "success",
      data: { id_etapa_ruta: ETAPA },
    });
  });

  it("el error conserva lo escrito, tambien la maquina y los tiempos", async () => {
    expect(await stateOf(create, createWith(withMachine, machine("inactiva")))).toMatchObject({
      status: "error",
      fieldErrors: { id_maquina: ['No se puede asignar la máquina "Plegadora": está inactiva.'] },
      values: {
        nombre_etapa: form.nombre_etapa,
        orden_secuencia: form.orden_secuencia,
        descripcion: form.descripcion,
      },
    });
  });

  it.each([
    ["alta", create, createWith()],
    ["edicion", update, updateWith()],
  ])("sin permiso, la %s responde con un error dentro del formulario", async (_name, run, actionCase) => {
    expect(await stateOf(run, { ...actionCase, role: "SELLER" })).toMatchObject({
      status: "error",
      error: "No tienes permisos para gestionar etapas de ruta.",
    });
  });

  it("un fallo al escribir responde con el mensaje generico", async () => {
    expect(
      await stateOf(create, createWith({}, { "etapa_ruta.create": failWith(new Error("conexion perdida")) })),
    ).toMatchObject({ status: "error", error: "No se pudo guardar la etapa. Intenta nuevamente." });
  });
});

// A6: el boton envia el estado que quiere dejar y la accion lo fija con una sola
// sentencia que compara y escribe, dentro de la transaccion de la bitacora: una
// lista desactualizada o un doble clic no hacen lo contrario de lo que dice.
describe("toggleRouteStageStatusAction con el estado pedido", () => {
  type Recorded = { prisma?: string; effect?: string; args?: Record<string, unknown> };

  async function run(actionCase: Omit<ActionCase, "name">) {
    const { calls, result } = await runCase(toggle, actionCase);

    return { calls: calls as Recorded[], state: (result as { estado: StatusToggleState }).estado };
  }

  it("fija el estado pedido solo si tiene el contrario y no redirige", async () => {
    const { calls, state } = await run(toggleOf(false));
    const write = calls.find((call) => call.prisma === "etapa_ruta.updateManyAndReturn");

    expect(write?.args?.where).toEqual({ id_etapa_ruta: ETAPA, estado: true });
    expect(write?.args?.data).toEqual({ estado: false });
    expect(calls.filter((call) => call.prisma === "etapa_ruta.update")).toEqual([]);
    expect(state).toMatchObject({ status: "success", data: { estado: false }, values: { id: ETAPA } });
  });

  it("no lee el estado antes de escribir", async () => {
    const { calls } = await run(toggleOf(true));
    const write = calls.findIndex((call) => call.prisma === "etapa_ruta.updateManyAndReturn");
    const read = calls.findIndex((call) => call.prisma === "etapa_ruta.findUnique");

    expect(write).toBeGreaterThanOrEqual(0);
    expect(read).toBe(-1);
  });

  it("si ya tenia ese estado responde sin bitacora ni revalidacion", async () => {
    const { calls, state } = await run(alreadyThere);

    expect(state).toMatchObject({ status: "error", error: "La etapa ya estaba inactiva." });
    expect(calls.filter((call) => call.effect === "registerAuditLog")).toEqual([]);
    expect(calls.filter((call) => call.effect === "revalidatePath")).toEqual([]);
  });

  it("si no existe lo dice", async () => {
    expect((await run(missing)).state).toMatchObject({ status: "error", error: "La etapa seleccionada no existe." });
  });

  it("un estado que no es true ni false se rechaza sin tocar Prisma", async () => {
    const { calls, state } = await run({ form: { id_etapa_ruta: ETAPA, estado: "quizas" } });

    expect(state).toMatchObject({ status: "error", error: "Estado no válido." });
    expect(calls.filter((call) => call.prisma)).toEqual([]);
  });

  it("sin permiso responde con un error, sin tocar Prisma", async () => {
    const { calls, state } = await run({ ...toggleOf(false), role: "SELLER" });

    expect(state).toMatchObject({ status: "error", error: "No tienes permisos para gestionar etapas de ruta." });
    expect(calls.filter((call) => call.prisma)).toEqual([]);
  });

  it("un fallo al escribir responde con el mensaje generico", async () => {
    const { calls, state } = await run({
      ...toggleOf(false),
      data: { "etapa_ruta.updateManyAndReturn": failWith(new Error("conexion perdida")) },
    });

    expect(state).toMatchObject({ status: "error", error: "No se pudo cambiar el estado de la etapa. Intenta nuevamente." });
    expect(calls.filter((call) => call.effect === "registerAuditLog")).toEqual([]);
  });
});
