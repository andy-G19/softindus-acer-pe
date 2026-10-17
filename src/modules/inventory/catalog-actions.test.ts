import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import type { StatusToggleState } from "@/lib/requested-status";
import type { InventoryCatalogFormState } from "@/modules/inventory/catalog-form-state";
import {
  createMaterialCategoryAction,
  toggleMaterialCategoryStatusAction,
  updateMaterialCategoryAction,
} from "@/modules/inventory/material-categories/actions";
import {
  createSupplierTypeAction,
  toggleSupplierTypeStatusAction,
  updateSupplierTypeAction,
} from "@/modules/inventory/supplier-types/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type PrismaArgs,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de los catalogos de inventario (entrega 10, sub-entrega
// 10.1), escrita antes de llevarlos a una ventana modal. Tipos de proveedor y
// categorias de material comparten el gestor InventoryCatalogManager y tienen
// las mismas acciones; los mismos casos corren sobre las dos. Fija en orden la
// autorizacion con sus roles, las lecturas, la transaccion con sus escrituras
// y su final, el correlativo, la bitacora (y si va dentro de la transaccion),
// las revalidaciones, la redireccion y el estado que devuelve al formulario.
//
// Desde la ventana modal (entrega 10), el alta y la edicion autorizan con
// getAuthorizedSession y devuelven el resultado (FormActionState): sin permiso
// responden con un error en lugar de redirigir. Activar e inactivar tambien
// devuelven el resultado (para ConfirmActionButton). La edicion y el cambio de
// estado escriben con el cliente global, sin transaccion, y registran la
// bitacora despues: el doble lo permite (writesOutsideTransaction) y lo marca.

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
      const next = (mocks.correlatives.get(params.prefijo) ?? 9) + 1;
      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
  };
});

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

type FormFields = Record<string, string>;
type FormAction = (prevState: InventoryCatalogFormState, formData: FormData) => Promise<InventoryCatalogFormState>;
type ToggleAction = (prevState: StatusToggleState, formData: FormData) => Promise<StatusToggleState>;
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

const initialState: InventoryCatalogFormState = { status: "idle" };
const initialToggleState: StatusToggleState = { status: "idle" };

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
// Catalogos
// ---------------------------------------------------------------------------

type Catalog = {
  name: string;
  model: string;
  idField: string;
  id: string;
  otherId: string;
  create: FormAction;
  update: FormAction;
  toggle: ToggleAction;
};

const CATALOGS: Catalog[] = [
  {
    name: "tipos de proveedor",
    model: "tipo_proveedor_catalogo",
    idField: "id_tipo_proveedor",
    id: "TPR00000003",
    otherId: "TPR00000001",
    create: createSupplierTypeAction,
    update: updateSupplierTypeAction,
    toggle: toggleSupplierTypeStatusAction,
  },
  {
    name: "categorias de material",
    model: "categoria_material",
    idField: "id_categoria_material",
    id: "CMA00000004",
    otherId: "CMA00000002",
    create: createMaterialCategoryAction,
    update: updateMaterialCategoryAction,
    toggle: toggleMaterialCategoryStatusAction,
  },
];

const createForm: FormFields = {
  nombre: "Distribuidor mayorista",
  slug: "distribuidor_mayorista",
  descripcion: "Proveedores que venden por volumen.",
};

type Row = Record<string, unknown>;

function whereOf(args: PrismaArgs) {
  return (args?.where ?? {}) as Row;
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`slug`)", {
    code: "P2002",
    clientVersion: "test",
  });
}

function failWith(error: Error) {
  return () => {
    throw error;
  };
}

for (const catalog of CATALOGS) {
  const { model, idField } = catalog;

  // Duplicado por nombre o slug (findFirst) y registro actual (findUnique).
  const lookup = ({
    duplicateOwner = null as string | null,
    exists = true,
    active = true,
  } = {}): DataOverrides => ({
    [`${model}.findFirst`]: () => (duplicateOwner ? { [idField]: duplicateOwner } : null),
    [`${model}.findUnique`]: (args: PrismaArgs) =>
      exists ? { [idField]: whereOf(args)[idField], nombre: "Distribuidor", estado: active } : null,
  });

  const withId = (fields: FormFields) => ({ ...fields, [idField]: catalog.id });

  describe(catalog.name, () => {
    defineCases("alta", (formData) => catalog.create(initialState, formData), [
      { name: "ADMIN crea un registro", form: createForm, data: lookup() },
      { name: "WORKSHOP_MASTER es rechazado antes de tocar Prisma", form: createForm, role: "WORKSHOP_MASTER" },
      { name: "SELLER es rechazado antes de tocar Prisma", form: createForm, role: "SELLER" },
      { name: "un nombre demasiado corto devuelve el error del campo sin tocar Prisma", form: { ...createForm, nombre: "A" } },
      { name: "un slug con mayusculas o guiones devuelve el error del campo", form: { ...createForm, slug: "Distribuidor-Mayorista" } },
      { name: "sin slug devuelve el error del campo", form: { ...createForm, slug: "" } },
      {
        name: "un nombre o slug repetido devuelve el error sin transaccion",
        form: createForm,
        data: lookup({ duplicateOwner: catalog.otherId }),
      },
      {
        name: "la descripcion vacia o con espacios se guarda como null",
        form: { ...createForm, descripcion: "   " },
        data: lookup(),
      },
      {
        name: "una carrera por el slug (P2002 al crear) revierte y marca el nombre",
        form: createForm,
        data: { ...lookup(), [`${model}.create`]: failWith(uniqueViolation()) },
      },
      {
        name: "otro fallo al crear revierte con el mensaje generico",
        form: createForm,
        data: { ...lookup(), [`${model}.create`]: failWith(new Error("conexion perdida")) },
      },
    ]);

    defineCases("edicion", (formData) => catalog.update(initialState, formData), [
      { name: "ADMIN actualiza un registro", form: withId(createForm), data: lookup() },
      { name: "WORKSHOP_MASTER es rechazado antes de tocar Prisma", form: withId(createForm), role: "WORKSHOP_MASTER" },
      { name: "sin id", form: createForm },
      { name: "un nombre demasiado corto devuelve el error del campo", form: withId({ ...createForm, nombre: "A" }) },
      {
        name: "el nombre o slug es de otro registro",
        form: withId(createForm),
        data: lookup({ duplicateOwner: catalog.otherId }),
      },
      {
        name: "conservar su propio nombre no es un duplicado",
        form: withId(createForm),
        data: lookup({ duplicateOwner: catalog.id }),
      },
      {
        name: "una carrera por el slug (P2002 al actualizar) marca el nombre",
        form: withId(createForm),
        data: { ...lookup(), [`${model}.update`]: failWith(uniqueViolation()) },
      },
      {
        name: "otro fallo al actualizar (tambien un id inexistente) da el mensaje generico sin bitacora",
        form: withId(createForm),
        data: { ...lookup(), [`${model}.update`]: failWith(new Error("Record to update not found")) },
      },
    ]);

    // Decision A de la 10.1: activar e inactivar envian el estado pedido y el
    // servidor solo lo fija si el registro tiene el contrario, comparando y
    // escribiendo en una sola sentencia (updateMany con el estado actual en el
    // where). count 0 es lo que responde la base cuando el registro no existe
    // o ya tiene el estado pedido: el doble lo simula.
    describe("estado pedido", () => {
      function writesOf(calls: unknown[]) {
        return (calls as Array<{ prisma?: string; args?: { data?: Row; where?: Row } }>).filter(
          (call) => call.prisma === `${model}.update` || call.prisma === `${model}.updateMany`,
        );
      }

      function auditsOf(calls: unknown[]) {
        return (calls as Array<{ effect?: string }>).filter((call) => call.effect === "registerAuditLog");
      }

      it("inactivar compara y fija el estado en una sola escritura", async () => {
        const { calls, outcome } = await runAction((formData) => catalog.toggle(initialToggleState, formData), {
          name: "",
          form: { [idField]: catalog.id, estado: "false" },
          data: lookup({ active: true }),
        });

        expect(writesOf(calls)).toEqual([
          expect.objectContaining({
            prisma: `${model}.updateMany`,
            args: { where: { [idField]: catalog.id, estado: true }, data: { estado: false } },
          }),
        ]);
        expect(auditsOf(calls)).toHaveLength(1);
        expect(outcome).toMatchObject({ estado: { status: "success", data: { estado: false } } });
      });

      it("pedir inactivar un registro que otro ya inactivo no lo activa ni escribe la bitacora", async () => {
        const { calls, outcome } = await runAction((formData) => catalog.toggle(initialToggleState, formData), {
          name: "",
          form: { [idField]: catalog.id, estado: "false" },
          data: { ...lookup({ active: false }), [`${model}.updateMany`]: () => ({ count: 0 }) },
        });

        expect(writesOf(calls).filter((call) => call.args?.data?.estado === true)).toEqual([]);
        expect(auditsOf(calls)).toEqual([]);
        expect(outcome).toMatchObject({ estado: { status: "error", error: expect.stringMatching(/ya estaba inactiv/) } });
      });

      it("pedir activar un registro que ya esta activo no lo inactiva ni escribe la bitacora", async () => {
        const { calls, outcome } = await runAction((formData) => catalog.toggle(initialToggleState, formData), {
          name: "",
          form: { [idField]: catalog.id, estado: "true" },
          data: { ...lookup({ active: true }), [`${model}.updateMany`]: () => ({ count: 0 }) },
        });

        expect(writesOf(calls).filter((call) => call.args?.data?.estado === false)).toEqual([]);
        expect(auditsOf(calls)).toEqual([]);
        expect(outcome).toMatchObject({ estado: { status: "error", error: expect.stringMatching(/ya estaba activ/) } });
      });

      it("sin estado pedido, o con uno que no es true ni false, no escribe nada", async () => {
        for (const form of [{ [idField]: catalog.id }, { [idField]: catalog.id, estado: "si" }]) {
          const { calls, outcome } = await runAction((formData) => catalog.toggle(initialToggleState, formData), {
            name: "",
            form,
            data: lookup({ active: true }),
          });

          expect(writesOf(calls)).toEqual([]);
          expect(auditsOf(calls)).toEqual([]);
          expect(outcome).toMatchObject({ estado: { status: "error", error: "Estado no válido." } });
        }
      });
    });

    defineCases("activar e inactivar", (formData) => catalog.toggle(initialToggleState, formData), [
      {
        name: "ADMIN inactiva un registro activo",
        form: { [idField]: catalog.id, estado: "false" },
        data: lookup({ active: true }),
      },
      {
        name: "ADMIN activa un registro inactivo",
        form: { [idField]: catalog.id, estado: "true" },
        data: lookup({ active: false }),
      },
      {
        name: "WORKSHOP_MASTER es rechazado antes de tocar Prisma",
        form: { [idField]: catalog.id, estado: "false" },
        role: "WORKSHOP_MASTER",
      },
      { name: "sin id responde con un error sin tocar nada", form: { estado: "false" } },
      {
        name: "un registro inexistente no cambia ninguna fila y responde que no existe, sin bitacora",
        form: { [idField]: catalog.id, estado: "false" },
        data: { ...lookup({ exists: false }), [`${model}.updateMany`]: () => ({ count: 0 }) },
      },
    ]);
  });
}
