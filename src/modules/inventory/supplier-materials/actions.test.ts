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
// que devuelve al formulario, con su mensaje exacto. Desde el panel lateral,
// el alta y la edicion devuelven el resultado (FormActionState) en lugar de
// redirigir, y niegan el permiso con un error dentro del formulario.
//
// El alta y la edicion exigen que el proveedor y el material esten activos,
// salvo, al editar, los que la asociacion ya tenia y no cambian: la consulta
// de edicion los ofrece aunque esten inactivos (hallazgo 4 de la 10.3a,
// corregido en la 10.3b). El alta escribe dentro de una transaccion; la edicion y el
// cambio de estado escriben con el cliente global, sin transaccion, y
// registran la bitacora despues: el doble lo permite (writesOutsideTransaction)
// y lo marca.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
// Cada respuesta del formulario lleva un operationId aleatorio; en los
// snapshots, uno fijo.
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

expect.addSnapshotSerializer(decimalSnapshotSerializer);

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

type FormFields = Record<string, string>;
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

const initialState: SupplierMaterialFormState = { status: "idle" };

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
  { name: "WORKSHOP_MASTER: sin permiso responde con un error, sin tocar Prisma", ...createWith({}), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...createWith({}), role: "SELLER" },
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
  { name: "WORKSHOP_MASTER: sin permiso responde con un error, sin tocar Prisma", ...updateWith({}), role: "WORKSHOP_MASTER" },
  { name: "sin id de asociacion responde que no existe sin tocar Prisma", ...updateWith({ id_proveedor_material: "" }) },
  { name: "la asociacion no existe", ...updateWith({}, currentRelation({ exists: false })) },
  {
    name: "datos invalidos devuelven los errores por campo despues de comprobar la asociacion",
    ...updateWith({ unidad_medida: "", precio_referencial: "-5" }),
  },
  {
    name: "hallazgo 4: con su proveedor actual inactivo y sin cambiarlo, lo busca sin exigir que este activo y guarda",
    ...updateWith({}, parents({ suppliers: { [PROVEEDOR]: false } })),
  },
  {
    name: "hallazgo 4: con su material actual inactivo y sin cambiarlo, lo busca sin exigir que este activo y guarda",
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

// Los mensajes que la accion devuelve al formulario llevan tildes (entrega
// 10.3b): antes decian «asociacion» y «esta».
describe("los mensajes de las asociaciones llevan tildes", () => {
  const messageOf = async (run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">) => {
    const { outcome } = await runAction(run, { name: "", ...actionCase });

    return (outcome as { estado: { error: string } }).estado.error;
  };

  it.each([
    ["proveedor inactivo", create, createWith({}, parents({ suppliers: { [PROVEEDOR]: false } })), "El proveedor seleccionado no existe o está inactivo."],
    ["material inactivo", create, createWith({}, parents({ materials: { [MATERIAL]: false } })), "El material seleccionado no existe o está inactivo."],
    ["asociacion repetida", create, createWith({}, duplicateOf(OTRA_ASOCIACION)), "Este proveedor ya está asociado con el material seleccionado."],
    ["fallo al guardar", create, createWith({}, { "proveedor_material.create": failWith(new Error("conexion perdida")) }), "No se pudo guardar la asociación proveedor-material. Intenta nuevamente."],
    ["datos invalidos", create, createWith({ unidad_medida: "" }), "Revisa los datos de la asociación."],
    ["asociacion inexistente", update, updateWith({}, currentRelation({ exists: false })), "La asociación proveedor-material no existe."],
    ["otra asociacion igual", update, updateWith({}, duplicateOf(OTRA_ASOCIACION)), "Ya existe otra asociación para ese proveedor y material."],
  ] as const)("%s", async (_name, run, actionCase, message) => {
    expect(await messageOf(run, actionCase)).toBe(message);
  });
});

// Hallazgo 4 de la 10.3a: la consulta de edicion ofrece el proveedor y el
// material que la asociacion ya tiene aunque esten inactivos, asi que la
// edicion los acepta mientras no se cambien; cambiar a otro sigue exigiendo
// que este activo, como el alta.
describe("updateSupplierMaterialAction acepta el proveedor y el material actuales aunque esten inactivos", () => {
  const OTRO_MATERIAL = "MAT00000002";

  function updatesOf(calls: unknown[]) {
    return (calls as Array<{ prisma?: string }>).filter((call) => call.prisma === "proveedor_material.update");
  }

  const edit = (fields: FormFields, data: DataOverrides) =>
    runAction(update, { name: "", form: { ...updateForm, ...fields }, data: { ...currentRelation(), ...duplicateOf(null), ...data } });

  it("con su proveedor actual inactivo, sin cambiarlo, guarda la asociacion", async () => {
    const { calls, outcome } = await edit({}, parents({ suppliers: { [PROVEEDOR]: false } }));

    expect(updatesOf(calls)).toHaveLength(1);
    expect(outcome).toMatchObject({ estado: { status: "success", data: { id_proveedor_material: ASOCIACION } } });
  });

  it("con su material actual inactivo, sin cambiarlo, guarda la asociacion", async () => {
    const { calls, outcome } = await edit({}, parents({ materials: { [MATERIAL]: false } }));

    expect(updatesOf(calls)).toHaveLength(1);
    expect(outcome).toMatchObject({ estado: { status: "success", data: { id_proveedor_material: ASOCIACION } } });
  });

  it("cambiar a otro proveedor inactivo se sigue rechazando", async () => {
    const { calls, outcome } = await edit(
      { id_proveedor: OTRO_PROVEEDOR },
      parents({ suppliers: { [PROVEEDOR]: false, [OTRO_PROVEEDOR]: false } }),
    );

    expect(updatesOf(calls)).toEqual([]);
    expect(outcome).toMatchObject({ estado: { fieldErrors: { id_proveedor: ["El proveedor seleccionado no existe o está inactivo."] } } });
  });

  it("cambiar a otro material inactivo se sigue rechazando", async () => {
    const { calls, outcome } = await edit(
      { id_material: OTRO_MATERIAL },
      parents({ materials: { [MATERIAL]: false, [OTRO_MATERIAL]: false } }),
    );

    expect(updatesOf(calls)).toEqual([]);
    expect(outcome).toMatchObject({ estado: { fieldErrors: { id_material: ["El material seleccionado no existe o está inactivo."] } } });
  });
});

// Activar e inactivar envian el estado pedido y el servidor solo lo fija si la
// asociacion tiene el contrario, comparando y escribiendo en una sola
// sentencia (updateMany con el estado actual en el where), con la fecha de
// actualizacion. count 0 es lo que responde la base cuando la asociacion no
// existe o ya tiene el estado pedido: el doble lo simula.
describe("toggleSupplierMaterialStatusAction fija el estado pedido", () => {
  function writesOf(calls: unknown[]) {
    return (calls as Array<{ prisma?: string; args?: { data?: Row; where?: Row } }>).filter(
      (call) => call.prisma === "proveedor_material.update" || call.prisma === "proveedor_material.updateMany",
    );
  }

  function auditsOf(calls: unknown[]) {
    return (calls as Array<{ effect?: string }>).filter((call) => call.effect === "registerAuditLog");
  }

  const toggle = (fields: FormFields, data: DataOverrides) =>
    runAction(toggleSupplierMaterialStatusAction, { name: "", form: fields, data });

  it("inactivar compara y fija el estado con su fecha en una sola escritura", async () => {
    const { calls, outcome } = await toggle(
      { id_proveedor_material: ASOCIACION, estado: "false" },
      currentRelation({ estado: true }),
    );

    expect(writesOf(calls)).toEqual([
      expect.objectContaining({
        prisma: "proveedor_material.updateMany",
        args: {
          where: { id_proveedor_material: ASOCIACION, estado: true },
          data: { estado: false, fecha_actualizacion: expect.any(Date) },
        },
      }),
    ]);
    expect(auditsOf(calls)).toHaveLength(1);
    expect(String(outcome)).toContain("toast=supplier-material-deactivated");
  });

  it("pedir inactivar una asociacion que otro ya inactivo no la activa ni escribe la bitacora", async () => {
    const { calls, outcome } = await toggle(
      { id_proveedor_material: ASOCIACION, estado: "false" },
      { ...currentRelation({ estado: false }), "proveedor_material.updateMany": () => ({ count: 0 }) },
    );

    expect(writesOf(calls).filter((call) => call.args?.data?.estado === true)).toEqual([]);
    expect(auditsOf(calls)).toEqual([]);
    expect(String(outcome)).not.toContain("toast=");
  });

  it("pedir activar una asociacion que ya esta activa no la inactiva ni escribe la bitacora", async () => {
    const { calls, outcome } = await toggle(
      { id_proveedor_material: ASOCIACION, estado: "true" },
      { ...currentRelation({ estado: true }), "proveedor_material.updateMany": () => ({ count: 0 }) },
    );

    expect(writesOf(calls).filter((call) => call.args?.data?.estado === false)).toEqual([]);
    expect(auditsOf(calls)).toEqual([]);
    expect(String(outcome)).not.toContain("toast=");
  });

  it("sin estado pedido, o con uno que no es true ni false, no escribe nada", async () => {
    const forms: FormFields[] = [
      { id_proveedor_material: ASOCIACION },
      { id_proveedor_material: ASOCIACION, estado: "si" },
    ];

    for (const form of forms) {
      const { calls } = await toggle(form, currentRelation({ estado: true }));

      expect(writesOf(calls)).toEqual([]);
      expect(auditsOf(calls)).toEqual([]);
    }
  });
});

defineCases("toggleSupplierMaterialStatusAction", toggleSupplierMaterialStatusAction, [
  {
    name: "inactiva una asociacion activa y actualiza su fecha",
    form: { id_proveedor_material: ASOCIACION, estado: "false" },
    data: currentRelation({ estado: true }),
  },
  {
    name: "activa una asociacion inactiva",
    form: { id_proveedor_material: ASOCIACION, estado: "true" },
    data: currentRelation({ estado: false }),
  },
  {
    name: "pedir inactivar una asociacion que ya esta inactiva no cambia ninguna fila ni registra bitacora",
    form: { id_proveedor_material: ASOCIACION, estado: "false" },
    data: { ...currentRelation({ estado: false }), "proveedor_material.updateMany": () => ({ count: 0 }) },
  },
  { name: "sin id vuelve al listado sin tocar Prisma", form: { estado: "false" } },
  {
    name: "con un estado pedido que no es true ni false vuelve al listado sin tocar Prisma",
    form: { id_proveedor_material: ASOCIACION, estado: "si" },
  },
  {
    name: "la asociacion no existe: no cambia ninguna fila y vuelve al listado sin bitacora",
    form: { id_proveedor_material: ASOCIACION, estado: "false" },
    data: { ...currentRelation({ exists: false }), "proveedor_material.updateMany": () => ({ count: 0 }) },
  },
  {
    name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma",
    form: { id_proveedor_material: ASOCIACION, estado: "false" },
    role: "WORKSHOP_MASTER",
  },
]);
