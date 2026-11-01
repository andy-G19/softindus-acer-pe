import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
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
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de etapas de ruta (entrega 10.6a), escrita
// antes de llevarlas al bloqueo de fila, al resultado de accion y al panel
// lateral. Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la
// bitacora y los correlativos simulados, y fija en un snapshot, en orden: la
// autorizacion con sus roles, las lecturas, la transaccion con sus escrituras y
// su final, los correlativos, la bitacora, las revalidaciones y el resultado:
// la redireccion, el error que lanza o el estado que devuelve al formulario.

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

const initialState: RouteStageFormState = { error: "" };
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

const toggleOf = (estado: boolean | null) => ({
  form: { id_etapa_ruta: ETAPA },
  data: {
    "etapa_ruta.findUnique":
      estado === null ? null : { id_etapa_ruta: ETAPA, id_ruta: RUTA, estado },
  } satisfies DataOverrides,
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createRouteStageAction", create, [
  { name: "ADMIN crea la etapa sin maquina", ...createWith() },
  { name: "WORKSHOP_MASTER tambien crea etapas", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", ...createWith(), role: "SELLER" },
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
  { name: "minutos que redondean a cero hoy se aceptan", ...createWith({ tiempo_operario_minutos_unidad: "0.001" }) },
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
    name: "una carrera por el orden (P2002) deja el error de Prisma",
    ...createWith({}, { "etapa_ruta.create": failWith(uniqueViolation()) }),
  },
]);

defineCases("updateRouteStageAction", update, [
  { name: "ADMIN actualiza la etapa", ...updateWith() },
  { name: "WORKSHOP_MASTER tambien actualiza etapas", ...updateWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", ...updateWith(), role: "SELLER" },
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
    name: "una carrera por el orden (P2002) deja el error de Prisma",
    ...updateWith({}, { "etapa_ruta.update": failWith(uniqueViolation()) }),
  },
]);

defineCases("toggleRouteStageStatusAction", toggleRouteStageStatusAction, [
  { name: "una etapa activa se inactiva", ...toggleOf(true) },
  { name: "una etapa inactiva se activa", ...toggleOf(false) },
  { name: "WORKSHOP_MASTER tambien cambia el estado", ...toggleOf(true), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", ...toggleOf(true), role: "SELLER" },
  { name: "sin id lanza su mensaje sin tocar Prisma", form: {} },
  { name: "la etapa no existe", ...toggleOf(null) },
  {
    name: "un fallo al escribir revierte y deja el error",
    form: toggleOf(true).form,
    data: { ...toggleOf(true).data, "etapa_ruta.update": failWith(new Error("conexion perdida")) },
  },
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
