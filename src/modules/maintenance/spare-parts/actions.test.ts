import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createSparePartAction,
  toggleSparePartStatusAction,
  updateSparePartAction,
  updateSparePartStatusAction,
  type SparePartFormState,
} from "@/modules/maintenance/spare-parts/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
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

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
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

const initialState: SparePartFormState = { error: "" };

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

const REPUESTO = "REP00000004";
const OTRO_REPUESTO = "REP00000002";
const PROVEEDOR = "PVE00000003";

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

// El repuesto buscado por id (existencia o cambio de estado), el que ya usa
// ese nombre (duplicado) y si el proveedor elegido existe y esta activo.
function sparePartLookup({
  exists = true,
  estado = true,
  duplicateOwner = null as string | null,
  activeProvider = true,
} = {}): DataOverrides {
  return {
    "repuesto.findUnique": exists
      ? { id_repuesto: REPUESTO, nombre_repuesto: "Faja en V B-52", estado }
      : null,
    "repuesto.findFirst": duplicateOwner ? { id_repuesto: duplicateOwner } : null,
    "proveedor.findFirst": activeProvider ? { id_proveedor: PROVEEDOR } : null,
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
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", ...createWith({}), role: "WORKSHOP_MASTER" },
  { name: "SELLER: requireRole lo rechaza (redirige) sin tocar Prisma", ...createWith({}), role: "SELLER" },
  {
    name: "datos invalidos devuelven los errores por campo sin tocar Prisma",
    form: { ...createForm, id_proveedor: "PVE1", nombre_repuesto: "F", costo_unitario: "-1", estado: "quizas" },
  },
  { name: "costo vacio: es obligatorio", form: { ...createForm, costo_unitario: "" } },
  { name: "costo que no es un numero", form: { ...createForm, costo_unitario: "abc" } },
  {
    name: "los obligatorios ausentes devuelven los mensajes de Zod en ingles",
    form: { ...createForm, nombre_repuesto: null, costo_unitario: null },
  },
  {
    name: "un costo que no cabe en numeric(12,2) pasa el esquema y llega a Prisma",
    ...createWith({ costo_unitario: "1e12" }),
  },
  {
    name: "un costo con tres decimales llega a Prisma sin redondear",
    ...createWith({ costo_unitario: "1.005" }),
  },
  {
    name: "proveedor inactivo o inexistente: error en el campo, sin transaccion",
    ...createWith({}, sparePartLookup({ activeProvider: false })),
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
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", ...updateWith({}), role: "WORKSHOP_MASTER" },
  { name: "sin id de repuesto responde que no existe sin tocar Prisma", ...updateWith({ id_repuesto: "" }) },
  { name: "el repuesto no existe", ...updateWith({}, sparePartLookup({ exists: false })) },
  {
    name: "datos invalidos devuelven los errores por campo despues de comprobar el repuesto",
    ...updateWith({ nombre_repuesto: "", costo_unitario: "abc" }),
  },
  {
    name: "conservar su proveedor actual inactivo se rechaza como si no existiera (hallazgo 4 de la 10.3a)",
    ...updateWith({}, sparePartLookup({ activeProvider: false })),
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

// Recibe el estado pedido y lo escribe aunque ya lo tenga: registra la
// bitacora igual. Solo la llama toggleSparePartStatusAction.
defineCases("updateSparePartStatusAction", updateSparePartStatusAction, [
  { name: "inactiva al pedir false", form: { id_repuesto: REPUESTO, estado: "false" }, data: sparePartLookup() },
  { name: "activa al pedir true", form: { id_repuesto: REPUESTO, estado: "true" }, data: sparePartLookup({ estado: false }) },
  {
    name: "pedir inactivar uno ya inactivo escribe y registra la bitacora igual",
    form: { id_repuesto: REPUESTO, estado: "false" },
    data: sparePartLookup({ estado: false }),
  },
  { name: "un estado invalido vuelve al listado sin tocar Prisma", form: { id_repuesto: REPUESTO, estado: "quizas" } },
  {
    name: "el repuesto no existe: vuelve al listado",
    form: { id_repuesto: REPUESTO, estado: "false" },
    data: sparePartLookup({ exists: false }),
  },
  {
    name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma",
    form: { id_repuesto: REPUESTO, estado: "false" },
    role: "WORKSHOP_MASTER",
  },
]);

// Hoy el cambio de estado lee el repuesto y pide el contrario de lo que lee:
// no recibe el estado que pide el boton.
defineCases("toggleSparePartStatusAction", toggleSparePartStatusAction, [
  { name: "inactiva un repuesto activo", form: { id_repuesto: REPUESTO }, data: sparePartLookup({ estado: true }) },
  { name: "activa un repuesto inactivo", form: { id_repuesto: REPUESTO }, data: sparePartLookup({ estado: false }) },
  {
    name: "pedir inactivar un repuesto que ya esta inactivo lo activa: el estado pedido no se lee",
    form: { id_repuesto: REPUESTO, estado: "false" },
    data: sparePartLookup({ estado: false }),
  },
  { name: "sin id vuelve al listado sin tocar Prisma", form: {} },
  {
    name: "el repuesto no existe: pide activarlo y vuelve al listado sin escribir",
    form: { id_repuesto: REPUESTO },
    data: sparePartLookup({ exists: false }),
  },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", form: { id_repuesto: REPUESTO }, role: "WORKSHOP_MASTER" },
]);
