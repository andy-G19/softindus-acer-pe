import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createMachineAction,
  toggleMachineStatusAction,
  updateMachineAction,
  type MachineFormState,
} from "@/modules/maintenance/machines/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de maquinas (entrega 10.5a), escrita antes
// de llevarlas al resultado de accion y al panel lateral. Cada caso ejecuta la
// accion real con Prisma, la sesion, la cache, la bitacora y los correlativos
// simulados, y fija en un snapshot, en orden: la autorizacion con sus roles,
// las lecturas, la transaccion con sus escrituras y su final, los
// correlativos, la bitacora (y si va dentro de la transaccion), las
// revalidaciones y el resultado: la redireccion o el estado que devuelve al
// formulario, con su mensaje exacto.
//
// El alta crea la maquina dentro de una transaccion, con su correlativo y la
// bitacora. La edicion y los cambios de estado escriben con el cliente global,
// sin transaccion, y registran la bitacora despues: el doble lo permite
// (writesOutsideTransaction) y lo marca.
//
// Desde el panel lateral (A4), el alta y la edicion devuelven el resultado
// (FormActionState) en lugar de redirigir y niegan el permiso con un error
// dentro del formulario; el cambio de estado sigue con requireRole y su
// redireccion. updateMachineStatusAction, sin uso, se retiro (D4).

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
      const next = (mocks.correlatives.get(params.prefijo) ?? 7) + 1;
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

const initialState: MachineFormState = { status: "idle" };

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) {
      formData.append(key, value);
    }
  }

  return formData;
}

function defineCases(name: string, run: (formData: FormData) => Promise<unknown>, cases: ActionCase[]) {
  describe(name, () => {
    for (const actionCase of cases) {
      it(actionCase.name, async () => {
        mocks.correlatives.clear();

        const { calls, result } = await characterizeHandler(
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

const MAQUINA = "MAQ00000004";
const OTRA_MAQUINA = "MAQ00000002";

const createForm: FormFields = {
  nombre: "Prensa hidraulica 60 t",
  tipo: "prensa",
  codigo_interno: "PH-60",
  ubicacion: "Nave 1",
  estado: "operativa",
  observaciones: "Revisar mangueras cada mes",
};

const updateForm: FormFields = {
  ...createForm,
  id_maquina: MAQUINA,
  nombre: "Prensa hidraulica 60 t (nave 2)",
  ubicacion: "Nave 2",
};

const emptyOptionals: FormFields = {
  codigo_interno: "",
  ubicacion: "",
  observaciones: "",
};

// La maquina buscada por id (existencia o cambio de estado) y la que ya usa
// ese nombre y tipo o ese codigo interno (duplicado).
function machineLookup({
  exists = true,
  estado = "operativa",
  duplicateOwner = null as string | null,
} = {}): DataOverrides {
  return {
    "maquina.findUnique": exists
      ? { id_maquina: MAQUINA, nombre: "Prensa hidraulica 60 t", estado }
      : null,
    "maquina.findFirst": duplicateOwner ? { id_maquina: duplicateOwner } : null,
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`codigo_interno`)",
    { code: "P2002", clientVersion: "test" },
  );
}

function failWith(error: Error) {
  return () => {
    throw error;
  };
}

const createWith = (fields: FormFields, data: DataOverrides = {}) => ({
  form: { ...createForm, ...fields },
  data: { ...machineLookup(), ...data },
});

const updateWith = (fields: FormFields, data: DataOverrides = {}) => ({
  form: { ...updateForm, ...fields },
  data: { ...machineLookup(), ...data },
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

const create = (formData: FormData) => createMachineAction(initialState, formData);
const update = (formData: FormData) => updateMachineAction(initialState, formData);

defineCases("createMachineAction", create, [
  { name: "crea la maquina con su correlativo y la bitacora dentro de la transaccion", ...createWith({}) },
  {
    name: "los opcionales vacios se guardan como null y sin codigo interno solo busca nombre y tipo",
    ...createWith(emptyOptionals),
  },
  {
    name: "los opcionales ausentes del formulario cuentan como vacios",
    ...createWith({ codigo_interno: null, ubicacion: null, observaciones: null }),
  },
  {
    name: "los textos llegan sin los espacios de los extremos",
    ...createWith({ nombre: "  Prensa hidraulica 60 t  ", tipo: " prensa ", codigo_interno: " PH-60 " }),
  },
  { name: "WORKSHOP_MASTER: sin permiso responde con un error, sin tocar Prisma", ...createWith({}), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...createWith({}), role: "SELLER" },
  {
    name: "datos invalidos devuelven los errores por campo sin tocar Prisma",
    form: { ...createForm, nombre: "P", tipo: "", estado: "rota", codigo_interno: "X".repeat(31) },
  },
  {
    name: "los obligatorios ausentes devuelven sus errores en espanol sin tocar Prisma",
    form: { ...createForm, nombre: null, tipo: null, estado: null },
  },
  {
    name: "otra maquina con ese nombre, tipo o codigo: error en el nombre, sin transaccion",
    ...createWith({}, machineLookup({ duplicateOwner: OTRA_MAQUINA })),
  },
  {
    name: "una carrera por el codigo interno (P2002 al crear) revierte con su mensaje, sin marcar campos",
    ...createWith({}, { "maquina.create": failWith(uniqueViolation()) }),
  },
  {
    name: "otro fallo al crear revierte con el mensaje generico",
    ...createWith({}, { "maquina.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("updateMachineAction", update, [
  { name: "ADMIN actualiza la maquina y registra la bitacora despues, fuera de transaccion", ...updateWith({}) },
  { name: "los opcionales vacios se guardan como null", ...updateWith(emptyOptionals) },
  { name: "la edicion puede dejarla en cualquier estado", ...updateWith({ estado: "dada_de_baja" }) },
  { name: "WORKSHOP_MASTER: sin permiso responde con un error, sin tocar Prisma", ...updateWith({}), role: "WORKSHOP_MASTER" },
  { name: "sin id de maquina responde que no existe sin tocar Prisma", ...updateWith({ id_maquina: "" }) },
  { name: "la maquina no existe", ...updateWith({}, machineLookup({ exists: false })) },
  {
    name: "datos invalidos devuelven los errores por campo despues de comprobar la maquina",
    ...updateWith({ nombre: "", estado: "rota" }),
  },
  {
    name: "otra maquina con ese nombre, tipo o codigo: error en el nombre",
    ...updateWith({}, machineLookup({ duplicateOwner: OTRA_MAQUINA })),
  },
  {
    name: "conservar su propio nombre y codigo no es un duplicado",
    ...updateWith({}, machineLookup({ duplicateOwner: MAQUINA })),
  },
  {
    name: "una carrera por el codigo interno (P2002 al actualizar) devuelve su mensaje y no registra bitacora",
    ...updateWith({}, { "maquina.update": failWith(uniqueViolation()) }),
  },
  {
    name: "otro fallo al actualizar devuelve el mensaje generico",
    ...updateWith({}, { "maquina.update": failWith(new Error("conexion perdida")) }),
  },
]);

// Hoy el cambio de estado lee la maquina y escribe el contrario de lo que lee:
// cualquier estado distinto de inactiva pasa a inactiva, e inactiva pasa a
// operativa. No recibe el estado que pide el boton.
defineCases("toggleMachineStatusAction", toggleMachineStatusAction, [
  { name: "inactiva una maquina operativa", form: { id_maquina: MAQUINA }, data: machineLookup({ estado: "operativa" }) },
  { name: "inactiva una maquina en reparacion", form: { id_maquina: MAQUINA }, data: machineLookup({ estado: "en_reparacion" }) },
  { name: "inactiva una maquina dada de baja", form: { id_maquina: MAQUINA }, data: machineLookup({ estado: "dada_de_baja" }) },
  { name: "activa una maquina inactiva: pasa a operativa", form: { id_maquina: MAQUINA }, data: machineLookup({ estado: "inactiva" }) },
  {
    name: "pedir inactivar una maquina que ya esta inactiva la activa: el estado pedido no se lee",
    form: { id_maquina: MAQUINA, estado: "inactiva" },
    data: machineLookup({ estado: "inactiva" }),
  },
  { name: "sin id vuelve al listado sin tocar Prisma", form: {} },
  { name: "la maquina no existe: vuelve al listado", form: { id_maquina: MAQUINA }, data: machineLookup({ exists: false }) },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", form: { id_maquina: MAQUINA }, role: "WORKSHOP_MASTER" },
]);
