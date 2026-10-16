import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createExpenseCategoryAction,
  toggleExpenseCategoryStatusAction,
  updateExpenseCategoryAction,
  type ExpenseCategoryFormState,
} from "@/modules/petty-cash/categories/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type PrismaArgs,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las categorias de gasto de caja chica (entrega 10,
// sub-entrega 10.1), escrita antes de llevarlas a una ventana modal. Fija en
// orden la autorizacion con sus roles, las lecturas, la transaccion con sus
// escrituras y su final, el correlativo, la bitacora (y si va dentro de la
// transaccion), las revalidaciones, la redireccion y el estado que devuelve
// al formulario.
//
// Hoy autorizan con requireRole(["ADMIN"]): sin permiso redirigen (el doble
// lanza AuthRejected). El alta y la edicion redirigen con ?toast= al guardar y
// devuelven el estado de error suelto al fallar. El nombre se recorta y el
// duplicado se busca sin distinguir mayusculas. La edicion comprueba primero
// que la categoria exista, escribe con el cliente global, sin transaccion, y
// registra la bitacora despues. El cambio de estado lee el registro y escribe
// el estado contrario.

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
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

const initialState: ExpenseCategoryFormState = { error: "" };

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

const CATEGORIA = "CGA00000004";
const OTRA_CATEGORIA = "CGA00000002";

const createForm: FormFields = {
  nombre_categoria: "Fletes y movilidad",
  descripcion: "Taxis y envios del taller.",
  estado: "true",
};

type Row = Record<string, unknown>;

function whereOf(args: PrismaArgs) {
  return (args?.where ?? {}) as Row;
}

// Duplicado por nombre (findFirst, sin distinguir mayusculas) y registro
// actual (findUnique).
function lookup({
  duplicateOwner = null as string | null,
  exists = true,
  active = true,
} = {}): DataOverrides {
  return {
    "categoria_gasto.findFirst": () => (duplicateOwner ? { id_categoria_gasto: duplicateOwner } : null),
    "categoria_gasto.findUnique": (args: PrismaArgs) =>
      exists
        ? { id_categoria_gasto: whereOf(args).id_categoria_gasto, nombre_categoria: "Fletes", estado: active }
        : null,
  };
}

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed on the fields: (`nombre_categoria`)", {
    code: "P2002",
    clientVersion: "test",
  });
}

function failWith(error: Error) {
  return () => {
    throw error;
  };
}

const withId = (fields: FormFields) => ({ ...fields, id_categoria_gasto: CATEGORIA });

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createExpenseCategoryAction", (formData) => createExpenseCategoryAction(initialState, formData), [
  { name: "ADMIN crea una categoria activa", form: createForm, data: lookup() },
  { name: "ADMIN crea una categoria inactiva", form: { ...createForm, estado: "false" }, data: lookup() },
  { name: "WORKSHOP_MASTER es rechazado antes de tocar Prisma", form: createForm, role: "WORKSHOP_MASTER" },
  { name: "SELLER es rechazado antes de tocar Prisma", form: createForm, role: "SELLER" },
  {
    name: "un nombre demasiado corto devuelve el error del campo sin tocar Prisma",
    form: { ...createForm, nombre_categoria: "Ab" },
  },
  { name: "un estado que no es true ni false devuelve el error del campo", form: { ...createForm, estado: "si" } },
  {
    name: "el nombre se recorta antes de buscar el duplicado y de guardar",
    form: { ...createForm, nombre_categoria: "  Fletes y movilidad  " },
    data: lookup(),
  },
  {
    name: "un nombre repetido (sin distinguir mayusculas) devuelve el error sin transaccion",
    form: createForm,
    data: lookup({ duplicateOwner: OTRA_CATEGORIA }),
  },
  { name: "la descripcion vacia se guarda como null", form: { ...createForm, descripcion: "" }, data: lookup() },
  {
    name: "una carrera por el nombre (P2002 al crear) revierte con el mensaje del duplicado",
    form: createForm,
    data: { ...lookup(), "categoria_gasto.create": failWith(uniqueViolation()) },
  },
  {
    name: "otro fallo al crear revierte con el mensaje generico",
    form: createForm,
    data: { ...lookup(), "categoria_gasto.create": failWith(new Error("conexion perdida")) },
  },
]);

defineCases("updateExpenseCategoryAction", (formData) => updateExpenseCategoryAction(initialState, formData), [
  { name: "ADMIN actualiza una categoria", form: withId(createForm), data: lookup() },
  { name: "WORKSHOP_MASTER es rechazado antes de tocar Prisma", form: withId(createForm), role: "WORKSHOP_MASTER" },
  { name: "sin id", form: createForm },
  { name: "la categoria no existe", form: withId(createForm), data: lookup({ exists: false }) },
  {
    name: "un nombre demasiado corto devuelve el error despues de comprobar la categoria",
    form: withId({ ...createForm, nombre_categoria: "Ab" }),
    data: lookup(),
  },
  {
    name: "el nombre es de otra categoria",
    form: withId(createForm),
    data: lookup({ duplicateOwner: OTRA_CATEGORIA }),
  },
  {
    name: "conservar su propio nombre no es un duplicado",
    form: withId(createForm),
    data: lookup({ duplicateOwner: CATEGORIA }),
  },
  {
    name: "inactivar desde la edicion guarda el estado del formulario",
    form: withId({ ...createForm, estado: "false" }),
    data: lookup(),
  },
  {
    name: "una carrera por el nombre (P2002 al actualizar) da el mensaje del duplicado",
    form: withId(createForm),
    data: { ...lookup(), "categoria_gasto.update": failWith(uniqueViolation()) },
  },
  {
    name: "otro fallo al actualizar da el mensaje generico sin bitacora",
    form: withId(createForm),
    data: { ...lookup(), "categoria_gasto.update": failWith(new Error("conexion perdida")) },
  },
]);

// Decision A de la 10.1: activar e inactivar envian el estado pedido y el
// servidor solo lo fija si la categoria tiene el contrario, comparando y
// escribiendo en una sola sentencia (updateMany con el estado actual en el
// where). count 0 es lo que responde la base cuando la categoria no existe o
// ya tiene el estado pedido: el doble lo simula.
describe("toggleExpenseCategoryStatusAction: estado pedido", () => {
  const run = (formData: FormData) => toggleExpenseCategoryStatusAction(formData);

  function writesOf(calls: unknown[]) {
    return (calls as Array<{ prisma?: string; args?: { data?: Row; where?: Row } }>).filter(
      (call) => call.prisma === "categoria_gasto.update" || call.prisma === "categoria_gasto.updateMany",
    );
  }

  function auditsOf(calls: unknown[]) {
    return (calls as Array<{ effect?: string }>).filter((call) => call.effect === "registerAuditLog");
  }

  it("inactivar compara y fija el estado en una sola escritura", async () => {
    const { calls, outcome } = await runAction(run, {
      name: "",
      form: { id_categoria_gasto: CATEGORIA, estado: "false" },
      data: lookup({ active: true }),
    });

    expect(writesOf(calls)).toEqual([
      expect.objectContaining({
        prisma: "categoria_gasto.updateMany",
        args: { where: { id_categoria_gasto: CATEGORIA, estado: true }, data: { estado: false } },
      }),
    ]);
    expect(auditsOf(calls)).toHaveLength(1);
    expect(String(outcome)).toContain("-deactivated");
  });

  it("pedir inactivar una categoria que otro ya inactivo no la activa ni escribe la bitacora", async () => {
    const { calls, outcome } = await runAction(run, {
      name: "",
      form: { id_categoria_gasto: CATEGORIA, estado: "false" },
      data: { ...lookup({ active: false }), "categoria_gasto.updateMany": () => ({ count: 0 }) },
    });

    expect(writesOf(calls).filter((call) => call.args?.data?.estado === true)).toEqual([]);
    expect(auditsOf(calls)).toEqual([]);
    expect(String(outcome)).not.toContain("toast=");
  });

  it("pedir activar una categoria que ya esta activa no la inactiva ni escribe la bitacora", async () => {
    const { calls, outcome } = await runAction(run, {
      name: "",
      form: { id_categoria_gasto: CATEGORIA, estado: "true" },
      data: { ...lookup({ active: true }), "categoria_gasto.updateMany": () => ({ count: 0 }) },
    });

    expect(writesOf(calls).filter((call) => call.args?.data?.estado === false)).toEqual([]);
    expect(auditsOf(calls)).toEqual([]);
    expect(String(outcome)).not.toContain("toast=");
  });

  it("sin estado pedido, o con uno que no es true ni false, no escribe nada", async () => {
    const forms: FormFields[] = [{ id_categoria_gasto: CATEGORIA }, { id_categoria_gasto: CATEGORIA, estado: "si" }];

    for (const form of forms) {
      const { calls } = await runAction(run, { name: "", form, data: lookup({ active: true }) });

      expect(writesOf(calls)).toEqual([]);
      expect(auditsOf(calls)).toEqual([]);
    }
  });
});

defineCases("toggleExpenseCategoryStatusAction", (formData) => toggleExpenseCategoryStatusAction(formData), [
  {
    name: "ADMIN inactiva una categoria activa",
    form: { id_categoria_gasto: CATEGORIA, estado: "false" },
    data: lookup({ active: true }),
  },
  {
    name: "ADMIN activa una categoria inactiva",
    form: { id_categoria_gasto: CATEGORIA, estado: "true" },
    data: lookup({ active: false }),
  },
  {
    name: "WORKSHOP_MASTER es rechazado antes de tocar Prisma",
    form: { id_categoria_gasto: CATEGORIA, estado: "false" },
    role: "WORKSHOP_MASTER",
  },
  { name: "sin id vuelve a la lista sin tocar nada", form: { estado: "false" } },
  {
    name: "una categoria inexistente no cambia ninguna fila y vuelve a la lista sin bitacora",
    form: { id_categoria_gasto: CATEGORIA, estado: "false" },
    data: { ...lookup({ exists: false }), "categoria_gasto.updateMany": () => ({ count: 0 }) },
  },
]);
