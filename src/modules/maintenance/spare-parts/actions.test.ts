import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createSparePartAction,
  toggleSparePartStatusAction,
  updateSparePartAction,
  type SparePartFormState,
} from "@/modules/maintenance/spare-parts/actions";
import type { StatusToggleState } from "@/lib/requested-status";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type PrismaArgs,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de repuestos (entrega 10.5a), escrita antes
// de llevarlas al resultado de accion y al panel lateral. Cada caso ejecuta la
// accion real con Prisma, la sesion, la cache, la bitacora y los correlativos
// simulados, y fija en un snapshot, en orden: la autorizacion con sus roles,
// las lecturas, la transaccion con sus escrituras y su final, los
// correlativos, la bitacora (y si va dentro de la transaccion), las
// revalidaciones y el resultado: la redireccion o el estado que devuelve al
// formulario, con su mensaje exacto.
//
// El alta crea el repuesto dentro de una transaccion, con su correlativo y la
// bitacora. La edicion y los cambios de estado escriben con el cliente global,
// sin transaccion, y registran la bitacora despues: el doble lo permite
// (writesOutsideTransaction) y lo marca. El repuesto no lleva stock: ninguna
// accion toca inventario.
//
// Desde el panel lateral (A6), el alta y la edicion devuelven el resultado
// (FormActionState) en lugar de redirigir y niegan el permiso con un error
// dentro del formulario. El cambio de estado (A7) recibe el estado pedido, lo
// fija con compare-and-set y devuelve el resultado a ConfirmActionButton;
// updateSparePartStatusAction, que solo usaba el cambio de estado, se retiro.

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
// `expected` fija el resultado ademas del snapshot: un snapshot nuevo se
// escribe con lo que hace el codigo, no con lo que deberia hacer.
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role; expected?: unknown };

const initialState: SparePartFormState = { status: "idle" };

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

        if ("expected" in actionCase) {
          expect(result).toEqual(actionCase.expected);
        }

        expect(calls).toMatchSnapshot("llamadas");
        expect(result).toMatchSnapshot("resultado");
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const REPUESTO = "REP00000004";
const OTRO_REPUESTO = "REP00000002";
const PROVEEDOR = "PVE00000003";
const OTRO_PROVEEDOR = "PVE00000006";

const createForm: FormFields = {
  id_proveedor: PROVEEDOR,
  nombre_repuesto: "Faja en V B-52",
  descripcion: "Para el motor de la cizalla",
  costo_unitario: "38.50",
  estado: "true",
};

const updateForm: FormFields = {
  ...createForm,
  id_repuesto: REPUESTO,
  nombre_repuesto: "Faja en V B-52 (reforzada)",
  costo_unitario: "41.90",
};

// El repuesto buscado por id (existencia o cambio de estado), con PROVEEDOR
// como proveedor actual; el que ya usa ese nombre (duplicado), y el estado del
// proveedor elegido: activo, inactivo o inexistente (null).
function sparePartLookup({
  exists = true,
  estado = true,
  duplicateOwner = null as string | null,
  providerActive = true as boolean | null,
} = {}): DataOverrides {
  const provider = (args: PrismaArgs) => {
    const where = (args?.where ?? {}) as Record<string, unknown>;

    if (providerActive === null || (where.estado === true && !providerActive)) {
      return null;
    }

    return { id_proveedor: where.id_proveedor, estado: providerActive };
  };

  return {
    "repuesto.findUnique": exists
      ? { id_repuesto: REPUESTO, nombre_repuesto: "Faja en V B-52", estado, id_proveedor: PROVEEDOR }
      : null,
    "repuesto.findFirst": duplicateOwner ? { id_repuesto: duplicateOwner } : null,
    "proveedor.findFirst": provider,
    "proveedor.findUnique": provider,
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`nombre_repuesto`)",
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
  data: { ...sparePartLookup(), ...data },
});

const updateWith = (fields: FormFields, data: DataOverrides = {}) => ({
  form: { ...updateForm, ...fields },
  data: { ...sparePartLookup(), ...data },
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

const create = (formData: FormData) => createSparePartAction(initialState, formData);
const update = (formData: FormData) => updateSparePartAction(initialState, formData);

defineCases("createSparePartAction", create, [
  { name: "crea el repuesto con su proveedor, su correlativo y la bitacora dentro de la transaccion", ...createWith({}) },
  {
    name: "sin proveedor no lo valida y lo guarda como null; la descripcion vacia tambien",
    ...createWith({ id_proveedor: "", descripcion: "" }),
  },
  {
    name: "sin estado en el formulario queda activo",
    ...createWith({ estado: null, id_proveedor: null, descripcion: null }),
  },
  { name: "puede crearse inactivo", ...createWith({ estado: "false" }) },
  {
    name: "los textos llegan sin los espacios de los extremos",
    ...createWith({ nombre_repuesto: "  Faja en V B-52  ", costo_unitario: " 38.50 ", id_proveedor: ` ${PROVEEDOR} ` }),
  },
  { name: "WORKSHOP_MASTER: sin permiso responde con un error, sin tocar Prisma", ...createWith({}), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...createWith({}), role: "SELLER" },
  {
    name: "datos invalidos devuelven los errores por campo sin tocar Prisma",
    form: { ...createForm, id_proveedor: "PVE1", nombre_repuesto: "F", costo_unitario: "-1", estado: "quizas" },
  },
  { name: "costo vacio: es obligatorio", form: { ...createForm, costo_unitario: "" } },
  { name: "costo que no es un numero", form: { ...createForm, costo_unitario: "abc" } },
  {
    name: "los obligatorios ausentes devuelven sus errores en espanol sin tocar Prisma",
    form: { ...createForm, nombre_repuesto: null, costo_unitario: null },
  },
  {
    name: "un costo que no cabe en numeric(12,2) se rechaza sin tocar Prisma",
    ...createWith({ costo_unitario: "1e12" }),
  },
  {
    name: "un costo con tres decimales llega a Prisma sin redondear",
    ...createWith({ costo_unitario: "1.005" }),
  },
  {
    name: "proveedor inactivo: error en el campo, sin transaccion",
    ...createWith({}, sparePartLookup({ providerActive: false })),
  },
  {
    name: "proveedor inexistente: el mismo error",
    ...createWith({}, sparePartLookup({ providerActive: null })),
  },
  {
    name: "otro repuesto con ese nombre: error en el campo, sin transaccion",
    ...createWith({}, sparePartLookup({ duplicateOwner: OTRO_REPUESTO })),
  },
  {
    name: "una carrera por el nombre (P2002 al crear) revierte con su mensaje, sin marcar campos",
    ...createWith({}, { "repuesto.create": failWith(uniqueViolation()) }),
  },
  {
    name: "otro fallo al crear revierte con el mensaje generico",
    ...createWith({}, { "repuesto.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("updateSparePartAction", update, [
  { name: "ADMIN actualiza el repuesto y registra la bitacora despues, fuera de transaccion", ...updateWith({}) },
  { name: "quitar el proveedor lo guarda como null sin validarlo", ...updateWith({ id_proveedor: "" }) },
  { name: "WORKSHOP_MASTER: sin permiso responde con un error, sin tocar Prisma", ...updateWith({}), role: "WORKSHOP_MASTER" },
  { name: "sin id de repuesto responde que no existe sin tocar Prisma", ...updateWith({ id_repuesto: "" }) },
  { name: "el repuesto no existe", ...updateWith({}, sparePartLookup({ exists: false })) },
  {
    name: "datos invalidos devuelven los errores por campo despues de comprobar el repuesto",
    ...updateWith({ nombre_repuesto: "", costo_unitario: "abc" }),
  },
  // D2 de la 10.5a (hallazgo 4 de la 10.3a): la edicion ofrece el proveedor
  // actual aunque este inactivo y la accion lo acepta mientras no se cambie.
  {
    name: "conservar su proveedor actual inactivo se acepta",
    ...updateWith({}, sparePartLookup({ providerActive: false })),
    expected: { estado: expect.objectContaining({ status: "success", data: { id_repuesto: REPUESTO } }) },
  },
  {
    name: "cambiar a otro proveedor inactivo se rechaza",
    ...updateWith({ id_proveedor: OTRO_PROVEEDOR }, sparePartLookup({ providerActive: false })),
    expected: {
      estado: expect.objectContaining({
        status: "error",
        error: "El proveedor seleccionado no existe o esta inactivo.",
        fieldErrors: { id_proveedor: ["El proveedor seleccionado no existe o esta inactivo."] },
      }),
    },
  },
  {
    name: "cambiar a otro proveedor activo se acepta",
    ...updateWith({ id_proveedor: OTRO_PROVEEDOR }),
    expected: { estado: expect.objectContaining({ status: "success", data: { id_repuesto: REPUESTO } }) },
  },
  {
    name: "su proveedor actual ya no existe: se rechaza",
    ...updateWith({}, sparePartLookup({ providerActive: null })),
    expected: {
      estado: expect.objectContaining({
        status: "error",
        error: "El proveedor seleccionado no existe o esta inactivo.",
        fieldErrors: { id_proveedor: ["El proveedor seleccionado no existe o esta inactivo."] },
      }),
    },
  },
  {
    name: "otro repuesto con ese nombre: error en el campo",
    ...updateWith({}, sparePartLookup({ duplicateOwner: OTRO_REPUESTO })),
  },
  {
    name: "conservar su propio nombre no es un duplicado",
    ...updateWith({}, sparePartLookup({ duplicateOwner: REPUESTO })),
  },
  {
    name: "una carrera por el nombre (P2002 al actualizar) devuelve su mensaje y no registra bitacora",
    ...updateWith({}, { "repuesto.update": failWith(uniqueViolation()) }),
  },
  {
    name: "otro fallo al actualizar devuelve el mensaje generico",
    ...updateWith({}, { "repuesto.update": failWith(new Error("conexion perdida")) }),
  },
]);

// El boton envia el estado pedido y la accion solo lo fija si el repuesto tiene
// el contrario (updateMany con el estado opuesto en el where); count 0 es lo
// que responde la base cuando no existe o ya tiene el estado pedido: el doble
// lo simula.
const initialToggleState: StatusToggleState = { status: "idle" };
const toggle = (formData: FormData) => toggleSparePartStatusAction(initialToggleState, formData);
const noRowChanged: DataOverrides = { "repuesto.updateMany": () => ({ count: 0 }) };

defineCases("toggleSparePartStatusAction", toggle, [
  { name: "inactiva un repuesto activo", form: { id_repuesto: REPUESTO, estado: "false" }, data: sparePartLookup() },
  { name: "activa un repuesto inactivo", form: { id_repuesto: REPUESTO, estado: "true" }, data: sparePartLookup({ estado: false }) },
  {
    name: "pedir inactivar un repuesto que ya esta inactivo no cambia ninguna fila ni registra bitacora",
    form: { id_repuesto: REPUESTO, estado: "false" },
    data: { ...sparePartLookup({ estado: false }), ...noRowChanged },
  },
  {
    name: "pedir activar un repuesto que ya esta activo no cambia ninguna fila ni registra bitacora",
    form: { id_repuesto: REPUESTO, estado: "true" },
    data: { ...sparePartLookup(), ...noRowChanged },
  },
  { name: "sin id responde que no existe sin tocar Prisma", form: { estado: "false" } },
  { name: "con un estado pedido que no es true ni false responde sin tocar Prisma", form: { id_repuesto: REPUESTO, estado: "si" } },
  {
    name: "el repuesto no existe: no cambia ninguna fila y responde sin bitacora",
    form: { id_repuesto: REPUESTO, estado: "false" },
    data: { ...sparePartLookup({ exists: false }), ...noRowChanged },
  },
  {
    name: "WORKSHOP_MASTER: sin permiso responde con un error, sin tocar Prisma",
    form: { id_repuesto: REPUESTO, estado: "false" },
    role: "WORKSHOP_MASTER",
  },
]);

// La escritura misma, fuera del snapshot: lo que decide que el boton nunca
// hace lo contrario de lo que dice.
describe("toggleSparePartStatusAction fija el estado pedido", () => {
  type Recorded = { prisma?: string; effect?: string; args?: unknown };

  async function run(estado: string, data: DataOverrides = sparePartLookup()) {
    const { calls, result } = await characterizeHandler(() => toggle(formOf({ id_repuesto: REPUESTO, estado })), data);
    const recorded = calls as Recorded[];

    return {
      writes: recorded.filter((call) => call.prisma?.startsWith("repuesto.update")),
      audits: recorded.filter((call) => call.effect === "registerAuditLog"),
      result: result as StatusToggleState,
    };
  }

  it("inactivar escribe false solo si el repuesto esta activo", async () => {
    const { writes, result } = await run("false");

    expect(writes).toEqual([
      expect.objectContaining({
        prisma: "repuesto.updateMany",
        args: { where: { id_repuesto: REPUESTO, estado: true }, data: { estado: false } },
      }),
    ]);
    expect(result).toMatchObject({ status: "success", data: { estado: false }, values: { id: REPUESTO } });
  });

  it("activar escribe true solo si el repuesto esta inactivo", async () => {
    const { writes, result } = await run("true");

    expect(writes).toEqual([
      expect.objectContaining({
        prisma: "repuesto.updateMany",
        args: { where: { id_repuesto: REPUESTO, estado: false }, data: { estado: true } },
      }),
    ]);
    expect(result).toMatchObject({ status: "success", data: { estado: true } });
  });

  it("sin fila cambiada responde con el estado que ya tenia y no registra bitacora", async () => {
    const deactivate = await run("false", { ...sparePartLookup({ estado: false }), ...noRowChanged });
    const activate = await run("true", { ...sparePartLookup(), ...noRowChanged });

    expect(deactivate.result).toMatchObject({ status: "error", error: "El repuesto ya estaba inactivo." });
    expect(activate.result).toMatchObject({ status: "error", error: "El repuesto ya estaba activo." });
    expect([...deactivate.audits, ...activate.audits]).toEqual([]);
  });
});
