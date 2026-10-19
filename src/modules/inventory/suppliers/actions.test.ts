import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createQuickSupplierAction,
  createSupplierAction,
  toggleSupplierStatusAction,
  updateSupplierAction,
  type SupplierFormState,
} from "@/modules/inventory/suppliers/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type PrismaArgs,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de proveedores (entrega 10.3b), escrita
// antes de llevarlas al resultado de accion y al panel lateral. Cada caso
// ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion con
// sus roles, las lecturas, la transaccion con sus escrituras y su final, los
// correlativos, la bitacora (y si va dentro de la transaccion), las
// revalidaciones y el resultado: la redireccion o el estado que devuelve al
// formulario, con su mensaje exacto.
//
// El alta crea el proveedor dentro de una transaccion, con su correlativo y la
// bitacora. La edicion y el cambio de estado escriben con el cliente global,
// sin transaccion, y registran la bitacora despues: el doble lo permite
// (writesOutsideTransaction) y lo marca. El alta rapida (desde repuestos) ya
// devuelve un resultado y niega el permiso sin redirigir.

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

type FormFields = Record<string, string>;
type HandlerCase = { name: string; data?: DataOverrides; role?: Role };
type ActionCase = HandlerCase & { form: FormFields };

const initialState: SupplierFormState = { error: "" };

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  return formData;
}

async function runHandler(run: () => Promise<unknown>, handlerCase: HandlerCase) {
  mocks.correlatives.clear();

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        return { estado: await run() };
      } catch (error) {
        return (
          describeNavigationError(error) ??
          `error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    handlerCase.data,
    { role: handlerCase.role },
  );

  return { calls, outcome: result };
}

function defineHandlerCases<C extends HandlerCase>(name: string, run: (handlerCase: C) => Promise<unknown>, cases: C[]) {
  describe(name, () => {
    for (const handlerCase of cases) {
      it(handlerCase.name, async () => {
        const { calls, outcome } = await runHandler(() => run(handlerCase), handlerCase);

        expectAuthorizesBeforePrisma(calls);
        expect(calls).toMatchSnapshot("llamadas");
        expect(outcome).toMatchSnapshot("resultado");
      });
    }
  });
}

function defineCases(name: string, run: (formData: FormData) => Promise<unknown>, cases: ActionCase[]) {
  defineHandlerCases<ActionCase>(name, (actionCase) => run(formOf(actionCase.form)), cases);
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const PROVEEDOR = "PVE00000004";
const OTRO_PROVEEDOR = "PVE00000002";

const createForm: FormFields = {
  razon_social: "Aceros del Sur S.A.C.",
  tipo_documento: "ruc",
  numero_documento: "20601234567",
  telefono: "999 888 777",
  correo: "ventas@acerosdelsur.pe",
  direccion: "Av. Industrial 123, Arequipa",
  contacto_principal: "Rosa Quispe",
  tipo_proveedor: "distribuidor",
  condicion_pago: "credito",
  observaciones: "Entrega en planta",
};

const updateForm: FormFields = {
  ...createForm,
  id_proveedor: PROVEEDOR,
  razon_social: "Aceros del Sur S.A.C. (Arequipa)",
  condicion_pago: "contado",
};

// Los opcionales vacios del formulario.
const emptyOptionals: FormFields = {
  tipo_documento: "",
  numero_documento: "",
  telefono: "",
  correo: "",
  direccion: "",
  contacto_principal: "",
  condicion_pago: "",
  observaciones: "",
};

type Row = Record<string, unknown>;

function whereOf(args: PrismaArgs) {
  return (args?.where ?? {}) as Row;
}

// Tipo de proveedor buscado por slug: activo, inactivo o inexistente.
function supplierType(estado: boolean | null): DataOverrides {
  return { "tipo_proveedor_catalogo.findUnique": estado === null ? null : { estado } };
}

// Proveedor buscado por id (existencia o cambio de estado) o por numero de
// documento (duplicado).
function supplierLookup({
  exists = true,
  documentOwner = null as string | null,
  estado = true,
} = {}): DataOverrides {
  return {
    "proveedor.findUnique": (args: PrismaArgs) => {
      const where = whereOf(args);

      if ("numero_documento" in where) {
        return documentOwner ? { id_proveedor: documentOwner } : null;
      }

      return exists
        ? { id_proveedor: where.id_proveedor, razon_social: "Aceros del Sur S.A.C.", estado }
        : null;
    },
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed on the fields: (`numero_documento`)",
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
  data: { ...supplierType(true), ...supplierLookup(), ...data },
});

const updateWith = (fields: FormFields, data: DataOverrides = {}) => ({
  form: { ...updateForm, ...fields },
  data: { ...supplierType(true), ...supplierLookup(), ...data },
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

const create = (formData: FormData) => createSupplierAction(initialState, formData);
const update = (formData: FormData) => updateSupplierAction(initialState, formData);

defineCases("createSupplierAction", create, [
  { name: "crea el proveedor activo con su correlativo y la bitacora dentro de la transaccion", ...createWith({}) },
  { name: "los opcionales vacios se guardan como null y sin documento no busca duplicados", ...createWith(emptyOptionals) },
  {
    name: "los textos llegan sin los espacios de los extremos",
    ...createWith({ razon_social: "  Aceros del Sur S.A.C.  ", numero_documento: " 20601234567 ", telefono: "  999 888 777 " }),
  },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", ...createWith({}), role: "WORKSHOP_MASTER" },
  { name: "SELLER: requireRole lo rechaza (redirige) sin tocar Prisma", ...createWith({}), role: "SELLER" },
  {
    name: "datos invalidos devuelven los errores por campo sin tocar Prisma",
    form: { ...createForm, razon_social: "A", tipo_documento: "pasaporte", correo: "no-es-correo", tipo_proveedor: "", condicion_pago: "trueque" },
  },
  { name: "tipo de proveedor inactivo: error en el campo, sin transaccion", ...createWith({}, supplierType(false)) },
  { name: "tipo de proveedor inexistente: el mismo error", ...createWith({}, supplierType(null)) },
  {
    name: "documento de otro proveedor: error en el campo, sin transaccion",
    ...createWith({}, supplierLookup({ documentOwner: OTRO_PROVEEDOR })),
  },
  {
    name: "una carrera por el documento (P2002 al crear) revierte y marca el campo",
    ...createWith({}, { "proveedor.create": failWith(uniqueViolation()) }),
  },
  {
    name: "otro fallo al crear revierte con el mensaje generico, sin marcar campos",
    ...createWith({}, { "proveedor.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("updateSupplierAction", update, [
  { name: "ADMIN actualiza el proveedor y registra la bitacora despues, fuera de transaccion", ...updateWith({}) },
  { name: "los opcionales vacios se guardan como null", ...updateWith(emptyOptionals) },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", ...updateWith({}), role: "WORKSHOP_MASTER" },
  { name: "sin id de proveedor responde que no existe sin tocar Prisma", ...updateWith({ id_proveedor: "" }) },
  { name: "el proveedor no existe", ...updateWith({}, supplierLookup({ exists: false })) },
  {
    name: "datos invalidos devuelven los errores por campo despues de comprobar el proveedor",
    ...updateWith({ razon_social: "", correo: "no-es-correo" }),
  },
  { name: "un tipo de proveedor inactivo se acepta al editar", ...updateWith({}, supplierType(false)) },
  { name: "tipo de proveedor inexistente: error en el campo", ...updateWith({}, supplierType(null)) },
  {
    name: "el documento es de otro proveedor: error en el campo",
    ...updateWith({}, supplierLookup({ documentOwner: OTRO_PROVEEDOR })),
  },
  {
    name: "conservar su propio documento no es un duplicado",
    ...updateWith({}, supplierLookup({ documentOwner: PROVEEDOR })),
  },
  {
    name: "una carrera por el documento (P2002 al actualizar) marca el campo",
    ...updateWith({}, { "proveedor.update": failWith(uniqueViolation()) }),
  },
  {
    name: "otro fallo al actualizar devuelve el mensaje generico y no registra bitacora",
    ...updateWith({}, { "proveedor.update": failWith(new Error("conexion perdida")) }),
  },
]);

// Hoy el cambio de estado lee el proveedor y escribe el contrario de lo que
// lee: no recibe el estado que pide el boton.
defineCases("toggleSupplierStatusAction", toggleSupplierStatusAction, [
  { name: "inactiva un proveedor activo", form: { id_proveedor: PROVEEDOR }, data: supplierLookup({ estado: true }) },
  { name: "activa un proveedor inactivo", form: { id_proveedor: PROVEEDOR }, data: supplierLookup({ estado: false }) },
  {
    name: "pedir inactivar un proveedor que ya esta inactivo lo activa: el estado pedido no se lee",
    form: { id_proveedor: PROVEEDOR, estado: "false" },
    data: supplierLookup({ estado: false }),
  },
  { name: "sin id vuelve al listado sin tocar Prisma", form: {} },
  { name: "el proveedor no existe: vuelve al listado", form: { id_proveedor: PROVEEDOR }, data: supplierLookup({ exists: false }) },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", form: { id_proveedor: PROVEEDOR }, role: "WORKSHOP_MASTER" },
]);

// Alta rapida desde el formulario de repuestos: recibe un objeto, no FormData.
type QuickInput = Parameters<typeof createQuickSupplierAction>[0];
type QuickCase = HandlerCase & { input: QuickInput };

const quickInput: QuickInput = {
  razon_social: "Ferreteria El Perno",
  tipo_proveedor: "ferreteria",
  telefono: "054 221 100",
};

// Proveedor buscado por razon social, sin distinguir mayusculas.
function existingByName(found: { id_proveedor: string; razon_social: string; estado: boolean } | null): DataOverrides {
  return { "proveedor.findFirst": found };
}

const quickWith = (input: Partial<QuickInput>, data: DataOverrides = {}) => ({
  input: { ...quickInput, ...input },
  data: { ...supplierType(true), ...existingByName(null), ...data },
});

defineHandlerCases<QuickCase>("createQuickSupplierAction", (quickCase) => createQuickSupplierAction(quickCase.input), [
  { name: "crea el proveedor con su correlativo y la bitacora dentro de la transaccion, sin redirigir", ...quickWith({}) },
  { name: "sin telefono lo guarda como null", ...quickWith({ telefono: "" }) },
  { name: "WORKSHOP_MASTER: responde sin permiso, sin tocar Prisma", ...quickWith({}), role: "WORKSHOP_MASTER" },
  { name: "SELLER: responde sin permiso, sin tocar Prisma", ...quickWith({}), role: "SELLER" },
  { name: "datos invalidos devuelven el primer mensaje sin tocar Prisma", ...quickWith({ razon_social: "A", tipo_proveedor: "" }) },
  { name: "tipo de proveedor inactivo", ...quickWith({}, supplierType(false)) },
  { name: "tipo de proveedor inexistente", ...quickWith({}, supplierType(null)) },
  {
    name: "ya existe uno activo con esa razon social: lo devuelve sin crear otro",
    ...quickWith({ razon_social: "ferreteria el perno" }, existingByName({ id_proveedor: OTRO_PROVEEDOR, razon_social: "Ferreteria El Perno", estado: true })),
  },
  {
    name: "ya existe uno inactivo con esa razon social: pide activarlo, sin crear",
    ...quickWith({}, existingByName({ id_proveedor: OTRO_PROVEEDOR, razon_social: "Ferreteria El Perno", estado: false })),
  },
  {
    name: "un fallo al crear revierte con el mensaje generico",
    ...quickWith({}, { "proveedor.create": failWith(new Error("conexion perdida")) }),
  },
]);
