import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createSupplierMaterialAction,
  toggleSupplierMaterialStatusAction,
  updateSupplierMaterialAction,
  type SupplierMaterialFormState,
} from "@/modules/inventory/supplier-materials/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type PrismaArgs,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de las asociaciones proveedor-material
// (entrega 10.3b), escrita antes de llevarlas al resultado de accion y al
// panel lateral. Cada caso ejecuta la accion real con Prisma, la sesion, la
// cache, la bitacora y los correlativos simulados, y fija en un snapshot, en
// orden: la autorizacion con sus roles, las lecturas, la transaccion con sus
// escrituras y su final, los correlativos, la bitacora (y si va dentro de la
// transaccion), las revalidaciones y el resultado: la redireccion o el estado
// que devuelve al formulario, con su mensaje exacto.
//
// El alta y la edicion exigen que el proveedor y el material esten activos;
// la edicion lo exige tambien al proveedor y al material que la asociacion ya
// tenia (hallazgo 4 de la 10.3a, que la consulta de edicion ofrece aunque
// esten inactivos). El alta escribe dentro de una transaccion; la edicion y el
// cambio de estado escriben con el cliente global, sin transaccion, y
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

const initialState: SupplierMaterialFormState = { error: "" };

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

const ASOCIACION = "PVM00000004";
const OTRA_ASOCIACION = "PVM00000002";
const PROVEEDOR = "PVE00000004";
const OTRO_PROVEEDOR = "PVE00000002";
const MATERIAL = "MAT00000004";

const createForm: FormFields = {
  id_proveedor: PROVEEDOR,
  id_material: MATERIAL,
  precio_referencial: "185.50",
  unidad_medida: "plancha",
  tiempo_entrega_dias: "3",
  disponibilidad: "alta",
};

const updateForm: FormFields = {
  ...createForm,
  id_proveedor_material: ASOCIACION,
  precio_referencial: "190",
  disponibilidad: "media",
};

const emptyOptionals: FormFields = {
  precio_referencial: "",
  tiempo_entrega_dias: "",
  disponibilidad: "",
};

type Row = Record<string, unknown>;

function whereOf(args: PrismaArgs) {
  return (args?.where ?? {}) as Row;
}

// Proveedores y materiales que existen, con su estado. La busqueda de la
// accion pide estado: true; un registro inactivo o que no existe no aparece.
function parents({
  suppliers = { [PROVEEDOR]: true } as Record<string, boolean>,
  materials = { [MATERIAL]: true } as Record<string, boolean>,
} = {}): DataOverrides {
  const lookup = (rows: Record<string, boolean>, idField: string, found: Row) => (args: PrismaArgs) => {
    const where = whereOf(args);
    const estado = rows[String(where[idField])];

    if (estado === undefined || (where.estado === true && !estado)) {
      return null;
    }

    return found;
  };

  return {
    "proveedor.findFirst": lookup(suppliers, "id_proveedor", { razon_social: "Aceros del Sur S.A.C." }),
    "material.findFirst": lookup(materials, "id_material", { nombre_material: "Plancha LAC 1/16" }),
  };
}

// Asociacion con el mismo proveedor y material (duplicado).
function duplicateOf(owner: string | null): DataOverrides {
  return { "proveedor_material.findFirst": owner ? { id_proveedor_material: owner } : null };
}

// La asociacion que se edita o cambia de estado, con el proveedor y el material
// que ya tiene.
function currentRelation({ exists = true, estado = true } = {}): DataOverrides {
  return {
    "proveedor_material.findUnique": exists
      ? {
          id_proveedor_material: ASOCIACION,
          id_proveedor: PROVEEDOR,
          id_material: MATERIAL,
          precio_referencial: new Prisma.Decimal("185.5"),
          unidad_medida: "plancha",
          tiempo_entrega_dias: 3,
          disponibilidad: "alta",
          estado,
          fecha_actualizacion: new Date("2026-07-01T15:00:00.000Z"),
          proveedor: { razon_social: "Aceros del Sur S.A.C." },
          material: { nombre_material: "Plancha LAC 1/16" },
        }
      : null,
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`id_proveedor`,`id_material`)",
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
  data: { ...parents(), ...duplicateOf(null), ...data },
});

const updateWith = (fields: FormFields, data: DataOverrides = {}) => ({
  form: { ...updateForm, ...fields },
  data: { ...currentRelation(), ...parents(), ...duplicateOf(null), ...data },
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

const create = (formData: FormData) => createSupplierMaterialAction(initialState, formData);
const update = (formData: FormData) => updateSupplierMaterialAction(initialState, formData);

defineCases("createSupplierMaterialAction", create, [
  { name: "crea la asociacion activa con su correlativo y la bitacora dentro de la transaccion", ...createWith({}) },
  { name: "los opcionales vacios se guardan como null", ...createWith(emptyOptionals) },
  { name: "el tiempo de entrega con decimales se trunca", ...createWith({ tiempo_entrega_dias: "7.8" }) },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", ...createWith({}), role: "WORKSHOP_MASTER" },
  { name: "SELLER: requireRole lo rechaza (redirige) sin tocar Prisma", ...createWith({}), role: "SELLER" },
  {
    name: "datos invalidos devuelven los errores por campo sin tocar Prisma",
    form: {
      id_proveedor: "",
      id_material: "",
      precio_referencial: "-1",
      unidad_medida: "",
      tiempo_entrega_dias: "abc",
      disponibilidad: "siempre",
    },
  },
  {
    name: "proveedor inactivo: error en el campo, sin transaccion",
    ...createWith({}, parents({ suppliers: { [PROVEEDOR]: false } })),
  },
  { name: "proveedor inexistente: el mismo error", ...createWith({}, parents({ suppliers: {} })) },
  {
    name: "material inactivo: error en el campo, sin transaccion",
    ...createWith({}, parents({ materials: { [MATERIAL]: false } })),
  },
  {
    name: "proveedor y material inactivos: solo informa el proveedor",
    ...createWith({}, parents({ suppliers: { [PROVEEDOR]: false }, materials: { [MATERIAL]: false } })),
  },
  {
    name: "ya existe la asociacion: error en el material, sin transaccion",
    ...createWith({}, duplicateOf(OTRA_ASOCIACION)),
  },
  {
    name: "una carrera por la misma asociacion (P2002 al crear) revierte con el mensaje de repetida, sin marcar campos",
    ...createWith({}, { "proveedor_material.create": failWith(uniqueViolation()) }),
  },
  {
    name: "otro fallo al crear revierte con el mensaje generico",
    ...createWith({}, { "proveedor_material.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("updateSupplierMaterialAction", update, [
  { name: "ADMIN actualiza la asociacion y registra la bitacora despues, fuera de transaccion", ...updateWith({}) },
  { name: "los opcionales vacios se guardan como null", ...updateWith(emptyOptionals) },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", ...updateWith({}), role: "WORKSHOP_MASTER" },
  { name: "sin id de asociacion responde que no existe sin tocar Prisma", ...updateWith({ id_proveedor_material: "" }) },
  { name: "la asociacion no existe", ...updateWith({}, currentRelation({ exists: false })) },
  {
    name: "datos invalidos devuelven los errores por campo despues de comprobar la asociacion",
    ...updateWith({ unidad_medida: "", precio_referencial: "-5" }),
  },
  {
    name: "hallazgo 4: su proveedor actual esta inactivo y no se cambia: la edicion falla",
    ...updateWith({}, parents({ suppliers: { [PROVEEDOR]: false } })),
  },
  {
    name: "hallazgo 4: su material actual esta inactivo y no se cambia: la edicion falla",
    ...updateWith({}, parents({ materials: { [MATERIAL]: false } })),
  },
  {
    name: "cambiar a otro proveedor inactivo: error en el campo",
    ...updateWith({ id_proveedor: OTRO_PROVEEDOR }, parents({ suppliers: { [PROVEEDOR]: true, [OTRO_PROVEEDOR]: false } })),
  },
  {
    name: "cambiar a otro proveedor activo guarda la asociacion con el nuevo",
    ...updateWith({ id_proveedor: OTRO_PROVEEDOR }, parents({ suppliers: { [PROVEEDOR]: true, [OTRO_PROVEEDOR]: true } })),
  },
  {
    name: "ya existe otra asociacion para ese proveedor y material: error en el material",
    ...updateWith({}, duplicateOf(OTRA_ASOCIACION)),
  },
  { name: "conservar su propia combinacion no es un duplicado", ...updateWith({}, duplicateOf(ASOCIACION)) },
  {
    name: "una carrera por la misma asociacion (P2002 al actualizar) da el mensaje de repetida",
    ...updateWith({}, { "proveedor_material.update": failWith(uniqueViolation()) }),
  },
  {
    name: "otro fallo al actualizar devuelve el mensaje generico y no registra bitacora",
    ...updateWith({}, { "proveedor_material.update": failWith(new Error("conexion perdida")) }),
  },
]);

// Hoy el cambio de estado lee la asociacion y escribe el contrario de lo que
// lee, con la fecha de actualizacion: no recibe el estado que pide el boton.
defineCases("toggleSupplierMaterialStatusAction", toggleSupplierMaterialStatusAction, [
  {
    name: "inactiva una asociacion activa y actualiza su fecha",
    form: { id_proveedor_material: ASOCIACION },
    data: currentRelation({ estado: true }),
  },
  {
    name: "activa una asociacion inactiva",
    form: { id_proveedor_material: ASOCIACION },
    data: currentRelation({ estado: false }),
  },
  {
    name: "pedir inactivar una asociacion que ya esta inactiva la activa: el estado pedido no se lee",
    form: { id_proveedor_material: ASOCIACION, estado: "false" },
    data: currentRelation({ estado: false }),
  },
  { name: "sin id vuelve al listado sin tocar Prisma", form: {} },
  {
    name: "la asociacion no existe: vuelve al listado",
    form: { id_proveedor_material: ASOCIACION },
    data: currentRelation({ exists: false }),
  },
  {
    name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma",
    form: { id_proveedor_material: ASOCIACION },
    role: "WORKSHOP_MASTER",
  },
]);
