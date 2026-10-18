import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createMaterialAction,
  toggleMaterialStatusAction,
  updateMaterialAction,
  type MaterialFormState,
} from "@/modules/inventory/materials/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type PrismaArgs,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de materiales (entrega 10.3), escrita antes
// de llevarlas al resultado de accion y al panel lateral. Cada caso ejecuta la
// accion real con Prisma, la sesion, la cache, la bitacora y los correlativos
// simulados, y fija en un snapshot, en orden: la autorizacion con sus roles,
// las lecturas, la transaccion con sus escrituras y su final, los
// correlativos, la bitacora (y si va dentro de la transaccion), las
// revalidaciones y el resultado: la redireccion o el estado que devuelve al
// formulario, con su mensaje exacto.
//
// El alta es la parte critica: dentro de una transaccion crea el material con
// su stock inicial, el kardex de ese stock (si es mayor que cero) y la alerta
// de stock (si hay minimo y el stock no lo supera), en ese orden. La edicion y
// el cambio de estado escriben con el cliente global, sin transaccion, y
// registran la bitacora despues: el doble lo permite (writesOutsideTransaction)
// y lo marca.

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

expect.addSnapshotSerializer(decimalSnapshotSerializer);

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

type FormFields = Record<string, string>;
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

const initialState: MaterialFormState = { error: "" };

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  return formData;
}

async function runAction(run: (formData: FormData) => Promise<unknown>, actionCase: ActionCase) {
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

  return { calls, outcome: result };
}

function defineCases(name: string, run: (formData: FormData) => Promise<unknown>, cases: ActionCase[]) {
  describe(name, () => {
    for (const actionCase of cases) {
      it(actionCase.name, async () => {
        const { calls, outcome } = await runAction(run, actionCase);

        expectAuthorizesBeforePrisma(calls);
        expect(calls).toMatchSnapshot("llamadas");
        expect(outcome).toMatchSnapshot("resultado");
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const MATERIAL = "MAT00000004";
const OTRO_MATERIAL = "MAT00000002";

const createForm: FormFields = {
  nombre_material: "Plancha LAC 1/16",
  categoria: "planchas",
  unidad_medida: "unidad",
  stock_actual: "2",
  stock_reservado: "0",
  stock_minimo: "5",
  costo_unitario_actual: "185.50",
};

// La edicion no lleva stock actual ni reservado; si llegan, se ignoran.
const updateForm: FormFields = {
  id_material: MATERIAL,
  nombre_material: "Plancha LAC 1/16 (2 mm)",
  categoria: "planchas",
  unidad_medida: "unidad",
  stock_minimo: "8",
  costo_unitario_actual: "190",
};

type Row = Record<string, unknown>;

function whereOf(args: PrismaArgs) {
  return (args?.where ?? {}) as Row;
}

// Categoria buscada por slug: activa, inactiva o inexistente.
function category(estado: boolean | null): DataOverrides {
  return { "categoria_material.findUnique": estado === null ? null : { estado } };
}

// Material buscado por id (existencia o cambio de estado) o por nombre
// (duplicado).
function materialLookup({
  exists = true,
  nameOwner = null as string | null,
  estado = true,
} = {}): DataOverrides {
  return {
    "material.findUnique": (args: PrismaArgs) => {
      const where = whereOf(args);

      if ("nombre_material" in where) {
        return nameOwner ? { id_material: nameOwner } : null;
      }

      return exists
        ? { id_material: where.id_material, nombre_material: "Plancha LAC 1/16", estado }
        : null;
    },
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`nombre_material`)",
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
  data: { ...category(true), ...materialLookup(), ...data },
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

const create = (formData: FormData) => createMaterialAction(initialState, formData);
const update = (formData: FormData) => updateMaterialAction(initialState, formData);

defineCases("createMaterialAction", create, [
  { name: "stock bajo el minimo: crea el material, el kardex inicial y la alerta", ...createWith({}) },
  { name: "stock sobre el minimo: kardex inicial sin alerta", ...createWith({ stock_actual: "20" }) },
  { name: "stock igual al minimo: tambien abre la alerta", ...createWith({ stock_actual: "5" }) },
  { name: "stock cero con minimo: alerta sin kardex", ...createWith({ stock_actual: "0" }) },
  { name: "sin minimo no hay alerta aunque el stock sea cero", ...createWith({ stock_actual: "0", stock_minimo: "0" }) },
  {
    name: "la alerta compara el stock actual, no el disponible (actual menos reservado)",
    ...createWith({ stock_actual: "6", stock_reservado: "4" }),
  },
  {
    name: "con mas de dos decimales decide con el numero del formulario: 5.004 sobre un minimo de 5 no abre alerta",
    ...createWith({ stock_actual: "5.004" }),
  },
  {
    name: "con mas de dos decimales: 0.004 escribe un kardex inicial",
    ...createWith({ stock_actual: "0.004", stock_minimo: "0" }),
  },
  {
    name: "los numeros vacios valen cero: ni kardex ni alerta",
    ...createWith({ stock_actual: "", stock_reservado: "", stock_minimo: "", costo_unitario_actual: "" }),
  },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", ...createWith({}), role: "WORKSHOP_MASTER" },
  { name: "SELLER: requireRole lo rechaza (redirige) sin tocar Prisma", ...createWith({}), role: "SELLER" },
  {
    name: "datos invalidos devuelven los errores por campo sin tocar Prisma",
    form: { ...createForm, nombre_material: "A", unidad_medida: "", stock_minimo: "-1", costo_unitario_actual: "abc" },
  },
  {
    name: "el reservado no puede superar el stock actual",
    form: { ...createForm, stock_actual: "2", stock_reservado: "3" },
  },
  { name: "categoria inactiva: error en el campo, sin transaccion", ...createWith({}, category(false)) },
  { name: "categoria inexistente: el mismo error", ...createWith({}, category(null)) },
  {
    name: "nombre de otro material: error en el campo, sin transaccion",
    ...createWith({}, materialLookup({ nameOwner: OTRO_MATERIAL })),
  },
  {
    name: "una carrera por el nombre (P2002 al crear) revierte y marca el campo",
    ...createWith({}, { "material.create": failWith(uniqueViolation()) }),
  },
  {
    name: "un fallo al crear la alerta revierte el material y el kardex con el mensaje generico",
    ...createWith({}, { "alerta_stock.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("updateMaterialAction", update, [
  { name: "ADMIN actualiza los datos sin tocar el stock", form: updateForm, data: { ...category(true), ...materialLookup() } },
  {
    name: "el stock actual y el reservado del formulario se ignoran",
    form: { ...updateForm, stock_actual: "999", stock_reservado: "10" },
    data: { ...category(true), ...materialLookup() },
  },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", form: updateForm, role: "WORKSHOP_MASTER" },
  { name: "sin id de material", form: { ...updateForm, id_material: "" } },
  { name: "el material no existe", form: updateForm, data: materialLookup({ exists: false }) },
  {
    name: "datos invalidos devuelven los errores por campo despues de comprobar el material",
    form: { ...updateForm, nombre_material: "A", stock_minimo: "-2" },
    data: materialLookup(),
  },
  {
    name: "una categoria inactiva se acepta al editar",
    form: updateForm,
    data: { ...category(false), ...materialLookup() },
  },
  { name: "categoria inexistente", form: updateForm, data: { ...category(null), ...materialLookup() } },
  {
    name: "el nombre es de otro material",
    form: updateForm,
    data: { ...category(true), ...materialLookup({ nameOwner: OTRO_MATERIAL }) },
  },
  {
    name: "conservar su propio nombre no es un duplicado",
    form: updateForm,
    data: { ...category(true), ...materialLookup({ nameOwner: MATERIAL }) },
  },
  {
    name: "una carrera por el nombre (P2002 al actualizar) marca el campo",
    form: updateForm,
    data: { ...category(true), ...materialLookup(), "material.update": failWith(uniqueViolation()) },
  },
  {
    name: "otro fallo al actualizar devuelve el mensaje generico y no registra bitacora",
    form: updateForm,
    data: { ...category(true), ...materialLookup(), "material.update": failWith(new Error("conexion perdida")) },
  },
]);

defineCases("toggleMaterialStatusAction", toggleMaterialStatusAction, [
  { name: "inactiva un material activo", form: { id_material: MATERIAL }, data: materialLookup({ estado: true }) },
  { name: "activa un material inactivo", form: { id_material: MATERIAL }, data: materialLookup({ estado: false }) },
  {
    name: "pedir inactivar un material que ya esta inactivo lo activa: el estado pedido no se lee",
    form: { id_material: MATERIAL, estado: "false" },
    data: materialLookup({ estado: false }),
  },
  { name: "sin id vuelve al listado sin tocar Prisma", form: {} },
  { name: "el material no existe: vuelve al listado", form: { id_material: MATERIAL }, data: materialLookup({ exists: false }) },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", form: { id_material: MATERIAL }, role: "WORKSHOP_MASTER" },
]);
