import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createProductAction,
  createProductCategoryAction,
  toggleProductCategoryStatusAction,
  toggleProductStatusAction,
  updateProductAction,
  updateProductCategoryAction,
  type ProductCategoryFormState,
  type ProductFormState,
} from "@/modules/commercial/products/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type PrismaArgs,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion del alta y la edicion de categorias de producto (entrega 9),
// escrita antes de que el piloto las lleve a una ventana modal. Fija en orden
// la autorizacion con sus roles, las lecturas, la transaccion con sus
// escrituras y su final, el correlativo, la bitacora (y si va dentro de la
// transaccion), las revalidaciones y el estado que devuelve al formulario.
//
// Hoy autorizan con requireRole: sin permiso redirigen (el doble lanza
// AuthRejected) en lugar de devolver un error. La edicion escribe con el
// cliente global, sin transaccion, y registra la bitacora despues: el doble lo
// permite (writesOutsideTransaction) y lo marca.
//
// Entrega 10.4a: tambien el alta, la edicion y el cambio de estado de
// productos y el cambio de estado de categorias, antes de llevar los productos
// al panel lateral y de pedir confirmacion al inactivar. Autorizan con
// requireRole y redirigen al negar el permiso (desviacion conocida); el alta y
// la edicion guardan redirigiendo a ?toast= sin los filtros del listado. El
// cambio de estado escribia el contrario de lo que leia (corregido en C2), y
// la edicion rechazaba la categoria actual del producto si estaba inactiva
// (corregido en C3).

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
// Entrega 9: cada respuesta lleva un operationId aleatorio; en los snapshots,
// uno fijo.
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
type CategoryAction = (
  prevState: ProductCategoryFormState,
  formData: FormData,
) => Promise<ProductCategoryFormState>;
type ProductAction = (prevState: ProductFormState, formData: FormData) => Promise<ProductFormState>;
type ToggleAction = (formData: FormData) => Promise<unknown>;
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

const initialState: ProductCategoryFormState = { status: "idle" };
const initialProductState: ProductFormState = { error: "" };

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

function defineActionSuite(name: string, action: CategoryAction, cases: ActionCase[]) {
  defineCases(name, (formData) => action(initialState, formData), cases);
}

function defineProductSuite(name: string, action: ProductAction, cases: ActionCase[]) {
  defineCases(name, (formData) => action(initialProductState, formData), cases);
}

function defineToggleSuite(name: string, action: ToggleAction, cases: ActionCase[]) {
  defineCases(name, action, cases);
}

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const CATEGORIA = "CPR00000004";
const OTRA_CATEGORIA = "CPR00000002";

const createForm: FormFields = {
  nombre: "Herramientas agrícolas",
  descripcion: "Uso interno de la categoría.",
};

type Row = Record<string, unknown>;

function whereOf(args: PrismaArgs) {
  return (args?.where ?? {}) as Row;
}

// Existencia por id (findUnique) y duplicado por nombre o slug (findFirst).
function categoryLookup({ exists = true, duplicateOwner = null as string | null } = {}): DataOverrides {
  return {
    "categoria_producto.findUnique": (args: PrismaArgs) =>
      exists ? { id_categoria_producto: whereOf(args).id_categoria_producto } : null,
    "categoria_producto.findFirst": () => (duplicateOwner ? { id_categoria_producto: duplicateOwner } : null),
  };
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

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineActionSuite("createProductCategoryAction", createProductCategoryAction, [
  { name: "ADMIN crea una categoria y el slug sale del nombre", form: createForm, data: categoryLookup() },
  { name: "SELLER es rechazado antes de tocar Prisma", form: createForm, role: "SELLER" },
  { name: "WORKSHOP_MASTER es rechazado antes de tocar Prisma", form: createForm, role: "WORKSHOP_MASTER" },
  { name: "un nombre demasiado corto devuelve el error del campo sin tocar Prisma", form: { nombre: "A", descripcion: "" } },
  { name: "un nombre sin letras ni numeros no da slug", form: { nombre: "!!!", descripcion: "" } },
  {
    name: "un nombre o slug repetido devuelve el error sin transaccion",
    form: createForm,
    data: categoryLookup({ duplicateOwner: OTRA_CATEGORIA }),
  },
  {
    name: "la descripcion vacia o con espacios se guarda como null",
    form: { nombre: "Soldadura", descripcion: "   " },
    data: categoryLookup(),
  },
  {
    name: "una carrera por el slug (P2002 al crear) revierte y marca el nombre",
    form: createForm,
    data: { ...categoryLookup(), "categoria_producto.create": failWith(uniqueViolation()) },
  },
  {
    name: "otro fallo al crear revierte con el mensaje generico",
    form: createForm,
    data: { ...categoryLookup(), "categoria_producto.create": failWith(new Error("conexion perdida")) },
  },
]);

defineActionSuite("updateProductCategoryAction", updateProductCategoryAction, [
  {
    name: "ADMIN actualiza una categoria",
    form: { ...createForm, id_categoria_producto: CATEGORIA },
    data: categoryLookup(),
  },
  {
    name: "SELLER es rechazado antes de tocar Prisma",
    form: { ...createForm, id_categoria_producto: CATEGORIA },
    role: "SELLER",
  },
  { name: "sin id de categoria", form: createForm },
  {
    name: "la categoria no existe",
    form: { ...createForm, id_categoria_producto: CATEGORIA },
    data: categoryLookup({ exists: false }),
  },
  {
    name: "un nombre demasiado corto devuelve el error despues de comprobar la categoria",
    form: { nombre: "A", descripcion: "", id_categoria_producto: CATEGORIA },
    data: categoryLookup(),
  },
  {
    name: "un nombre sin letras ni numeros no da slug",
    form: { nombre: "!!!", descripcion: "", id_categoria_producto: CATEGORIA },
    data: categoryLookup(),
  },
  {
    name: "el nombre o slug es de otra categoria",
    form: { ...createForm, id_categoria_producto: CATEGORIA },
    data: categoryLookup({ duplicateOwner: OTRA_CATEGORIA }),
  },
  {
    name: "conservar su propio nombre no es un duplicado",
    form: { ...createForm, id_categoria_producto: CATEGORIA },
    data: categoryLookup({ duplicateOwner: CATEGORIA }),
  },
  {
    name: "una carrera por el slug (P2002 al actualizar) marca el nombre",
    form: { ...createForm, id_categoria_producto: CATEGORIA },
    data: { ...categoryLookup(), "categoria_producto.update": failWith(uniqueViolation()) },
  },
  {
    name: "otro fallo al actualizar devuelve el mensaje generico y no registra bitacora",
    form: { ...createForm, id_categoria_producto: CATEGORIA },
    data: { ...categoryLookup(), "categoria_producto.update": failWith(new Error("conexion perdida")) },
  },
]);

// ---------------------------------------------------------------------------
// Productos (entrega 10.4a)
// ---------------------------------------------------------------------------

const PRODUCTO = "PRO00000004";
const OTRO_PRODUCTO = "PRO00000002";

const productForm: FormFields = {
  nombre_producto: "Lampa agrícola reforzada",
  categoria: "herramientas",
  unidad_medida: "unidad",
  precio_referencial: "35.50",
  descripcion: "Mango de eucalipto.",
};

// Categoria buscada por slug al validar el producto: activa, inactiva o (sin
// entrada) inexistente.
function categoryStates(states: Record<string, boolean>): DataOverrides {
  return {
    "categoria_producto.findUnique": (args: PrismaArgs) => {
      const slug = String(whereOf(args).slug);

      return slug in states ? { estado: states[slug] } : null;
    },
  };
}

// Producto buscado por id (existencia o cambio de estado) o por nombre
// (duplicado). Su categoria actual es "herramientas".
function productLookup({ exists = true, nameOwner = null as string | null, estado = true } = {}): DataOverrides {
  return {
    "producto.findUnique": (args: PrismaArgs) => {
      const where = whereOf(args);

      if ("nombre_producto" in where) {
        return nameOwner ? { id_producto: nameOwner } : null;
      }

      return exists
        ? { id_producto: where.id_producto, nombre_producto: "Lampa agrícola reforzada", categoria: "herramientas", estado }
        : null;
    },
  };
}

// Categoria que lee su cambio de estado, por id.
function categoryStatusLookup({ exists = true, estado = true } = {}): DataOverrides {
  return {
    "categoria_producto.findUnique": (args: PrismaArgs) =>
      exists
        ? { id_categoria_producto: whereOf(args).id_categoria_producto, nombre: "Herramientas agrícolas", estado }
        : null,
  };
}

const productWith = (fields: FormFields, data: DataOverrides = {}) => ({
  form: { ...productForm, ...fields },
  data: { ...categoryStates({ herramientas: true }), ...productLookup(), ...data },
});

const productUpdateWith = (fields: FormFields, data: DataOverrides = {}) =>
  productWith({ id_producto: PRODUCTO, ...fields }, data);

defineProductSuite("createProductAction", createProductAction, [
  { name: "ADMIN crea el producto activo con su correlativo y la bitacora dentro de la transaccion", ...productWith({}) },
  { name: "sin precio y con la descripcion en blanco guarda null", ...productWith({ precio_referencial: "", descripcion: "   " }) },
  { name: "SELLER: requireRole lo rechaza (redirige) sin tocar Prisma", ...productWith({}), role: "SELLER" },
  { name: "WORKSHOP_MASTER: requireRole lo rechaza (redirige) sin tocar Prisma", ...productWith({}), role: "WORKSHOP_MASTER" },
  {
    name: "datos invalidos devuelven los errores por campo sin tocar Prisma",
    ...productWith({ nombre_producto: "A", categoria: "", unidad_medida: "", precio_referencial: "-1" }),
  },
  {
    name: "una descripcion de mas de 500 caracteres devuelve el mensaje de Zod en ingles",
    ...productWith({ descripcion: "x".repeat(501) }),
  },
  { name: "categoria inactiva: error en el campo, sin transaccion", ...productWith({}, categoryStates({ herramientas: false })) },
  { name: "categoria inexistente: el mismo error", ...productWith({}, categoryStates({})) },
  {
    name: "nombre de otro producto: error en el campo, sin transaccion",
    ...productWith({}, productLookup({ nameOwner: OTRO_PRODUCTO })),
  },
  {
    name: "una carrera por el nombre (P2002 al crear) revierte y marca el campo",
    ...productWith({}, { "producto.create": failWith(uniqueViolation()) }),
  },
  {
    name: "otro fallo al crear revierte con el mensaje generico, sin marcar campos",
    ...productWith({}, { "producto.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineProductSuite("updateProductAction", updateProductAction, [
  { name: "ADMIN actualiza el producto y registra la bitacora despues, fuera de transaccion", ...productUpdateWith({}) },
  { name: "vaciar el precio y la descripcion guarda null", ...productUpdateWith({ precio_referencial: "", descripcion: "" }) },
  { name: "SELLER: requireRole lo rechaza (redirige) sin tocar Prisma", ...productUpdateWith({}), role: "SELLER" },
  { name: "sin id de producto responde que no existe sin tocar Prisma", ...productUpdateWith({ id_producto: "" }) },
  { name: "el producto no existe", ...productUpdateWith({}, productLookup({ exists: false })) },
  {
    name: "datos invalidos devuelven los errores por campo despues de comprobar el producto",
    ...productUpdateWith({ nombre_producto: "A", unidad_medida: "" }),
  },
  {
    name: "cambiar a una categoria inactiva: error en el campo",
    ...productUpdateWith({ categoria: "soldadura" }, categoryStates({ herramientas: true, soldadura: false })),
  },
  {
    name: "conservar su categoria actual inactiva se acepta mientras no se cambie",
    ...productUpdateWith({}, categoryStates({ herramientas: false })),
  },
  { name: "el nombre es de otro producto: error en el campo", ...productUpdateWith({}, productLookup({ nameOwner: OTRO_PRODUCTO })) },
  { name: "conservar su propio nombre no es un duplicado", ...productUpdateWith({}, productLookup({ nameOwner: PRODUCTO })) },
  {
    name: "una carrera por el nombre (P2002 al actualizar) marca el campo",
    ...productUpdateWith({}, { "producto.update": failWith(uniqueViolation()) }),
  },
  {
    name: "otro fallo al actualizar devuelve el mensaje generico y no registra bitacora",
    ...productUpdateWith({}, { "producto.update": failWith(new Error("conexion perdida")) }),
  },
]);

// Los dos cambios de estado reciben el estado que pide el boton y lo fijan con
// compare-and-set (C2); count 0 si no existe o ya lo tenia.
defineToggleSuite("toggleProductStatusAction", toggleProductStatusAction, [
  {
    name: "inactiva un producto activo",
    form: { id_producto: PRODUCTO, estado: "false" },
    data: productLookup({ estado: true }),
  },
  {
    name: "activa un producto inactivo",
    form: { id_producto: PRODUCTO, estado: "true" },
    data: productLookup({ estado: false }),
  },
  {
    name: "pedir inactivar un producto que ya esta inactivo no cambia ninguna fila ni registra bitacora",
    form: { id_producto: PRODUCTO, estado: "false" },
    data: { ...productLookup({ estado: false }), "producto.updateMany": () => ({ count: 0 }) },
  },
  { name: "sin id vuelve al listado sin tocar Prisma", form: { estado: "false" } },
  {
    name: "con un estado pedido que no es true ni false vuelve al listado sin tocar Prisma",
    form: { id_producto: PRODUCTO, estado: "si" },
  },
  {
    name: "el producto no existe: no cambia ninguna fila y vuelve al listado sin bitacora",
    form: { id_producto: PRODUCTO, estado: "false" },
    data: { ...productLookup({ exists: false }), "producto.updateMany": () => ({ count: 0 }) },
  },
  {
    name: "SELLER: requireRole lo rechaza (redirige) sin tocar Prisma",
    form: { id_producto: PRODUCTO, estado: "false" },
    role: "SELLER",
  },
]);

defineToggleSuite("toggleProductCategoryStatusAction", toggleProductCategoryStatusAction, [
  {
    name: "inactiva una categoria activa y revalida categorias y productos",
    form: { id_categoria_producto: CATEGORIA, estado: "false" },
    data: categoryStatusLookup({ estado: true }),
  },
  {
    name: "activa una categoria inactiva",
    form: { id_categoria_producto: CATEGORIA, estado: "true" },
    data: categoryStatusLookup({ estado: false }),
  },
  {
    name: "pedir inactivar una categoria que ya esta inactiva no cambia ninguna fila ni registra bitacora",
    form: { id_categoria_producto: CATEGORIA, estado: "false" },
    data: { ...categoryStatusLookup({ estado: false }), "categoria_producto.updateMany": () => ({ count: 0 }) },
  },
  { name: "sin id vuelve al listado sin tocar Prisma", form: { estado: "false" } },
  {
    name: "con un estado pedido que no es true ni false vuelve al listado sin tocar Prisma",
    form: { id_categoria_producto: CATEGORIA, estado: "si" },
  },
  {
    name: "la categoria no existe: no cambia ninguna fila y vuelve al listado sin bitacora",
    form: { id_categoria_producto: CATEGORIA, estado: "false" },
    data: { ...categoryStatusLookup({ exists: false }), "categoria_producto.updateMany": () => ({ count: 0 }) },
  },
  {
    name: "SELLER: requireRole lo rechaza (redirige) sin tocar Prisma",
    form: { id_categoria_producto: CATEGORIA, estado: "false" },
    role: "SELLER",
  },
]);

// Activar e inactivar envian el estado pedido y el servidor solo lo fija si el
// registro tiene el contrario, comparando y escribiendo en una sola sentencia
// (updateMany con el estado opuesto en el where), como proveedores en la 10.3b.
// count 0 es lo que responde la base cuando no existe o ya tiene el estado
// pedido: el doble lo simula.
type StatusToggleSpec = {
  name: string;
  action: ToggleAction;
  model: string;
  idField: string;
  id: string;
  lookup: (options: { estado: boolean }) => DataOverrides;
  deactivatedToast: string;
};

function describeRequestedStatus(spec: StatusToggleSpec) {
  type Recorded = { prisma?: string; effect?: string; args?: { data?: Row; where?: Row } };

  const writesOf = (calls: unknown[]) =>
    (calls as Recorded[]).filter(
      (call) => call.prisma === `${spec.model}.update` || call.prisma === `${spec.model}.updateMany`,
    );
  const auditsOf = (calls: unknown[]) => (calls as Recorded[]).filter((call) => call.effect === "registerAuditLog");
  const toggle = (estado: string | undefined, data: DataOverrides) =>
    runAction(spec.action, {
      name: "",
      form: estado === undefined ? { [spec.idField]: spec.id } : { [spec.idField]: spec.id, estado },
      data,
    });
  const noRowChanged = { [`${spec.model}.updateMany`]: () => ({ count: 0 }) };

  describe(`${spec.name} fija el estado pedido`, () => {
    it("inactivar compara y fija el estado en una sola escritura", async () => {
      const { calls, outcome } = await toggle("false", spec.lookup({ estado: true }));

      expect(writesOf(calls)).toEqual([
        expect.objectContaining({
          prisma: `${spec.model}.updateMany`,
          args: { where: { [spec.idField]: spec.id, estado: true }, data: { estado: false } },
        }),
      ]);
      expect(auditsOf(calls)).toHaveLength(1);
      expect(String(outcome)).toContain(`toast=${spec.deactivatedToast}`);
    });

    it("pedir inactivar uno que otro ya inactivo no lo activa ni escribe la bitacora", async () => {
      const { calls, outcome } = await toggle("false", { ...spec.lookup({ estado: false }), ...noRowChanged });

      expect(writesOf(calls).filter((call) => call.args?.data?.estado === true)).toEqual([]);
      expect(auditsOf(calls)).toEqual([]);
      expect(String(outcome)).not.toContain("toast=");
    });

    it("pedir activar uno que ya esta activo no lo inactiva ni escribe la bitacora", async () => {
      const { calls, outcome } = await toggle("true", { ...spec.lookup({ estado: true }), ...noRowChanged });

      expect(writesOf(calls).filter((call) => call.args?.data?.estado === false)).toEqual([]);
      expect(auditsOf(calls)).toEqual([]);
      expect(String(outcome)).not.toContain("toast=");
    });

    it("sin estado pedido, o con uno que no es true ni false, no escribe nada", async () => {
      for (const estado of [undefined, "si"]) {
        const { calls } = await toggle(estado, spec.lookup({ estado: true }));

        expect(writesOf(calls)).toEqual([]);
        expect(auditsOf(calls)).toEqual([]);
      }
    });
  });
}

describeRequestedStatus({
  name: "toggleProductStatusAction",
  action: toggleProductStatusAction,
  model: "producto",
  idField: "id_producto",
  id: PRODUCTO,
  lookup: ({ estado }) => productLookup({ estado }),
  deactivatedToast: "product-deactivated",
});

// La edicion ofrece la categoria actual del producto aunque este inactiva
// (getProductEditData), asi que la accion debe aceptarla mientras no se
// cambie; cambiar a otra sigue exigiendo que este activa, como el alta. Como
// las asociaciones proveedor-material en la 10.3b.
describe("updateProductAction con la categoria actual inactiva", () => {
  type Recorded = { prisma?: string; args?: { data?: Row } };

  const update = (fields: FormFields, states: Record<string, boolean>) =>
    runAction((formData) => updateProductAction(initialProductState, formData), {
      name: "",
      ...productUpdateWith(fields, categoryStates(states)),
    });
  const productUpdates = (calls: unknown[]) =>
    (calls as Recorded[]).filter((call) => call.prisma === "producto.update");

  it("conservar su categoria actual inactiva guarda el producto", async () => {
    const { calls, outcome } = await update({}, { herramientas: false });

    expect(productUpdates(calls)).toEqual([
      expect.objectContaining({ args: expect.objectContaining({ data: expect.objectContaining({ categoria: "herramientas" }) }) }),
    ]);
    expect(String(outcome)).toContain("toast=product-updated");
  });

  it("cambiar a otra categoria inactiva se sigue rechazando", async () => {
    const { calls, outcome } = await update({ categoria: "soldadura" }, { herramientas: false, soldadura: false });

    expect(productUpdates(calls)).toEqual([]);
    expect(JSON.stringify(outcome)).toContain("Selecciona una categoría activa.");
  });

  it("una categoria actual que ya no existe se rechaza", async () => {
    const { calls, outcome } = await update({}, {});

    expect(productUpdates(calls)).toEqual([]);
    expect(JSON.stringify(outcome)).toContain("Selecciona una categoría activa.");
  });
});

describeRequestedStatus({
  name: "toggleProductCategoryStatusAction",
  action: toggleProductCategoryStatusAction,
  model: "categoria_producto",
  idField: "id_categoria_producto",
  id: CATEGORIA,
  lookup: ({ estado }) => categoryStatusLookup({ estado }),
  deactivatedToast: "product-category-deactivated",
});
