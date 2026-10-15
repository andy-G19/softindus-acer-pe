import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createProductCategoryAction,
  updateProductCategoryAction,
  type ProductCategoryFormState,
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
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

const initialState = { error: "" } as ProductCategoryFormState;

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  return formData;
}

async function runAction(action: CategoryAction, actionCase: ActionCase) {
  mocks.correlatives.clear();

  const { calls, result } = await characterizeHandler(
    async () => {
      try {
        return { estado: await action(initialState, formOf(actionCase.form)) };
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

function defineActionSuite(name: string, action: CategoryAction, cases: ActionCase[]) {
  describe(name, () => {
    for (const actionCase of cases) {
      it(actionCase.name, async () => {
        const { calls, outcome } = await runAction(action, actionCase);

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
