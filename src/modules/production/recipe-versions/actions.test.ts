import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createRecipeVersionAction,
  setCurrentRecipeVersionAction,
  voidRecipeVersionAction,
} from "@/modules/production/recipe-versions/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de versiones de receta (entrega 10.6b),
// escrita antes de llevarlas al bloqueo de fila, al resultado de accion y a su
// superficie. Cada caso ejecuta la accion real con Prisma, la sesion, la cache,
// la bitacora y los correlativos simulados, y fija en un snapshot, en orden: la
// autorizacion con sus roles, las lecturas, la transaccion con sus escrituras y
// su final, los correlativos, la bitacora, las revalidaciones y el resultado.

const mocks = vi.hoisted(() => ({
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/action-result", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/action-result")>()),
  newOperationId: () => "operacion-de-prueba",
}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock({
    transactions: true,
    recordTransactionEnd: true,
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

  function reserve(prefijo: string, cantidad: number) {
    const last = mocks.correlatives.get(prefijo) ?? 11;

    mocks.correlatives.set(prefijo, last + cantidad);

    return Array.from({ length: cantidad }, (_, index) => formatCorrelativeId(prefijo, last + index + 1));
  }

  return {
    ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
    getNextCorrelativeId: async (_tx: unknown, params: { codigoEntidad: string; prefijo: string }) => {
      recordEffect("getNextCorrelativeId", params);

      return reserve(params.prefijo, 1)[0];
    },
    getNextCorrelativeIds: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string; cantidad: number },
    ) => {
      recordEffect("getNextCorrelativeIds", params);

      return reserve(params.prefijo, params.cantidad);
    },
  };
});

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

// null deja el campo fuera del formulario; una lista repite el campo.
type FormFields = Record<string, string | string[] | null>;
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    for (const item of value === null ? [] : [value].flat()) {
      formData.append(key, item);
    }
  }

  return formData;
}

async function runCase(run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">) {
  mocks.correlatives.clear();

  return characterizeHandler(
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
}

function defineCases(name: string, run: (formData: FormData) => Promise<unknown>, cases: ActionCase[]) {
  describe(name, () => {
    for (const actionCase of cases) {
      it(actionCase.name, async () => {
        const { calls, result } = await runCase(run, actionCase);

        expectAuthorizesBeforePrisma(calls);
        expect(calls).toMatchSnapshot("llamadas");
        expect(result).toMatchSnapshot("resultado");
      });
    }
  });
}

const IDLE = { status: "idle" } as const;
const setCurrent = (formData: FormData) => setCurrentRecipeVersionAction(IDLE, formData);
const voidVersion = (formData: FormData) => voidRecipeVersionAction(IDLE, formData);
const create = (formData: FormData) => createRecipeVersionAction(IDLE, formData);

const failWith = (error: Error) => () => {
  throw error;
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const RECETA = "REC00000003";
const VERSION = "VER00000005";
const OTRA_VERSION = "VER00000004";
const ACERO = "MAT00000001";
const PINTURA = "MAT00000002";

const twoLines: FormFields = {
  id_receta: RECETA,
  motivo_cambio: "Cambio de proveedor",
  id_material: [ACERO, PINTURA],
  cantidad_requerida: ["2.5", "1"],
  tipo_consumo: ["materia_prima", "consumible"],
  merma_estimada_porcentaje: ["5", "0"],
  observaciones_detalle: ["", "Solo primera mano"],
};

const activeRecipe = (exists = true): DataOverrides => ({
  "receta_tecnica.findFirst": exists ? { id_receta: RECETA, version_receta: [] } : null,
});

const materials = (...ids: string[]): DataOverrides => ({
  "material.findMany": ids.map((id) => ({
    id_material: id,
    unidad_medida: id === ACERO ? "kg" : "gl",
  })),
});

const history = (...numbers: string[]): DataOverrides => ({
  "version_receta.findMany": numbers.map((numero_version) => ({ numero_version })),
  "version_receta.findFirst": null,
});

const createWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...twoLines, ...fields },
  data: { ...activeRecipe(), ...materials(ACERO, PINTURA), ...history("V1", "V2"), ...data },
});

const statusForm: FormFields = { id_receta: RECETA, id_version_receta: VERSION };

const versionOf = (estado: string | null, recetaEstado = "activa", orders = 0) => ({
  id_version_receta: VERSION,
  id_receta: RECETA,
  numero_version: "V2",
  estado,
  receta_tecnica: { id_receta: RECETA, estado: recetaEstado },
  orden_trabajo: Array.from({ length: orders }, (_, index) => ({ id_orden_trabajo: `OTR0000000${index + 1}` })),
});

// La misma lectura sirve para la version pedida y para buscar su reemplazo: esta
// ultima es la que excluye la version pedida.
const versions = (
  estado: string | null,
  options: { receta?: string; orders?: number; replacement?: boolean } = {},
): DataOverrides => ({
  "version_receta.findFirst": (args) => {
    const where = (args as { where?: { id_version_receta?: unknown } }).where;

    if (typeof where?.id_version_receta === "object") {
      return options.replacement === false ? null : { id_version_receta: OTRA_VERSION };
    }

    return estado === null ? null : versionOf(estado, options.receta, options.orders);
  },
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createRecipeVersionAction", create, [
  { name: "ADMIN crea la version vigente y reemplaza la anterior", ...createWith() },
  { name: "WORKSHOP_MASTER tambien crea versiones", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: responde con un error sin tocar Prisma", ...createWith(), role: "SELLER" },
  { name: "la primera version es la V1", ...createWith({}, history()) },
  {
    name: "el numero sigue al mayor, no al ultimo ni a los que no tienen digitos",
    ...createWith({}, history("V7", "V2", "piloto")),
  },
  { name: "un numero enviado se respeta", ...createWith({ numero_version: "V9-B" }) },
  {
    name: "un numero enviado que ya existe se rechaza",
    ...createWith({ numero_version: "V2" }, { "version_receta.findFirst": { id_version_receta: OTRA_VERSION } }),
  },
  { name: "sin motivo se guarda null", ...createWith({ motivo_cambio: "" }) },
  {
    name: "una linea sin merma ni observaciones",
    ...createWith({
      id_material: [ACERO],
      cantidad_requerida: ["2"],
      tipo_consumo: ["auxiliar"],
      merma_estimada_porcentaje: null,
      observaciones_detalle: null,
    }),
  },
  { name: "sin lineas responde su mensaje", ...createWith({ id_material: null }) },
  {
    name: "cada error va a su linea",
    ...createWith({ cantidad_requerida: ["0", "-1"], tipo_consumo: ["otro", "consumible"] }),
  },
  { name: "un material repetido se rechaza", ...createWith({ id_material: [ACERO, ACERO] }) },
  { name: "un material vacio se rechaza", ...createWith({ id_material: [ACERO, ""] }) },
  { name: "la receta no existe o esta inactiva", ...createWith({}, activeRecipe(false)) },
  { name: "un material no existe o esta inactivo", ...createWith({}, materials(ACERO)) },
  {
    name: "una carrera (P2002) responde sin el error interno",
    ...createWith({}, { "version_receta.create": failWith(uniqueViolation()) }),
  },
  {
    name: "un fallo en las lineas revierte y responde sin el error interno",
    ...createWith({}, { "detalle_receta.createMany": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("setCurrentRecipeVersionAction", setCurrent, [
  {
    name: "una reemplazada pasa a vigente y la vigente queda reemplazada",
    form: statusForm,
    data: versions("reemplazada"),
  },
  { name: "WORKSHOP_MASTER tambien la marca", form: statusForm, data: versions("reemplazada"), role: "WORKSHOP_MASTER" },
  { name: "SELLER: responde con un error sin tocar Prisma", form: statusForm, data: versions("reemplazada"), role: "SELLER" },
  { name: "sin receta responde su mensaje sin tocar Prisma", form: { id_version_receta: VERSION } },
  { name: "sin version responde su mensaje sin tocar Prisma", form: { id_receta: RECETA } },
  { name: "la version no existe", form: statusForm, data: versions(null) },
  { name: "la receta no esta activa", form: statusForm, data: versions("reemplazada", { receta: "inactiva" }) },
  { name: "una anulada no se puede marcar", form: statusForm, data: versions("anulada") },
  { name: "la que ya es vigente responde sin escribir", form: statusForm, data: versions("vigente") },
  {
    name: "un fallo al escribir revierte y deja el error",
    form: statusForm,
    data: { ...versions("reemplazada"), "version_receta.update": failWith(new Error("conexion perdida")) },
  },
]);

defineCases("voidRecipeVersionAction", voidVersion, [
  { name: "una reemplazada se anula", form: statusForm, data: versions("reemplazada") },
  { name: "la vigente se anula y promueve la mas reciente no anulada", form: statusForm, data: versions("vigente") },
  { name: "WORKSHOP_MASTER tambien anula", form: statusForm, data: versions("reemplazada"), role: "WORKSHOP_MASTER" },
  { name: "SELLER: responde con un error sin tocar Prisma", form: statusForm, data: versions("reemplazada"), role: "SELLER" },
  { name: "sin version responde su mensaje sin tocar Prisma", form: { id_receta: RECETA } },
  { name: "la version no existe", form: statusForm, data: versions(null) },
  { name: "ya estaba anulada", form: statusForm, data: versions("anulada") },
  { name: "usada por ordenes no se anula", form: statusForm, data: versions("reemplazada", { orders: 2 }) },
  {
    name: "la vigente sin otra version valida no se anula",
    form: statusForm,
    data: versions("vigente", { replacement: false }),
  },
  {
    name: "con la receta inactiva tambien se anula",
    form: statusForm,
    data: versions("reemplazada", { receta: "inactiva" }),
  },
  {
    name: "un fallo al promover revierte y deja el error",
    form: statusForm,
    data: {
      ...versions("vigente"),
      "version_receta.update": (args) => {
        if ((args as { where: { id_version_receta: string } }).where.id_version_receta === OTRA_VERSION) {
          throw new Error("conexion perdida");
        }

        return null;
      },
    },
  },
]);

// El orden importa: uq_version_receta_vigente admite una sola vigente por receta.
describe("el orden de las escrituras respeta la unica vigente", () => {
  type Recorded = { prisma?: string; args?: { data?: { estado?: string } } };

  const written = async (run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">) =>
    ((await runCase(run, actionCase)).calls as Recorded[])
      .filter((call) => call.prisma?.startsWith("version_receta.") && call.args?.data?.estado)
      .map((call) => `${call.prisma}:${call.args?.data?.estado}`);

  it("el alta reemplaza antes de crear", async () => {
    expect(await written(create, createWith())).toEqual([
      "version_receta.updateMany:reemplazada",
      "version_receta.create:vigente",
    ]);
  });

  it("marcar vigente reemplaza antes de promover", async () => {
    expect(await written(setCurrent, { form: statusForm, data: versions("reemplazada") })).toEqual([
      "version_receta.updateMany:reemplazada",
      "version_receta.update:vigente",
    ]);
  });

  it("anular la vigente anula antes de promover", async () => {
    expect(await written(voidVersion, { form: statusForm, data: versions("vigente") })).toEqual([
      "version_receta.update:anulada",
      "version_receta.update:vigente",
    ]);
  });
});

// B2 (hallazgo 1 de la auditoria de la 10.6): dos altas a la vez ya no chocan con
// uq_version_receta_vigente ni con uq_version_receta_numero: la segunda espera a
// la primera y lee el numero y la vigente que dejo.
describe("las acciones de versiones deciden con la receta bloqueada", () => {
  const protectedRead = (call: { prisma: string }) =>
    /^(receta_tecnica|version_receta|material)\.find/.test(call.prisma);

  const repeatedNumber = createWith(
    { numero_version: "V2" },
    { "version_receta.findFirst": { id_version_receta: OTRA_VERSION } },
  );

  const cases: [string, (formData: FormData) => Promise<unknown>, Omit<ActionCase, "name">][] = [
    ["el alta que acepta", create, createWith()],
    ["el alta de una receta inactiva", create, createWith({}, activeRecipe(false))],
    ["el alta con un numero repetido", create, repeatedNumber],
    ["marcar una reemplazada", setCurrent, { form: statusForm, data: versions("reemplazada") }],
    ["marcar la que ya es vigente", setCurrent, { form: statusForm, data: versions("vigente") }],
    ["marcar una anulada", setCurrent, { form: statusForm, data: versions("anulada") }],
    ["anular la vigente", voidVersion, { form: statusForm, data: versions("vigente") }],
    ["anular una reemplazada", voidVersion, { form: statusForm, data: versions("reemplazada") }],
    ["anular una que no existe", voidVersion, { form: statusForm, data: versions(null) }],
  ];

  it.each(cases)("%s", async (_name, run, actionCase) => {
    const { calls } = await runCase(run, actionCase);

    expectRowLockedBefore(calls, { table: "receta_tecnica", id: RECETA, reads: protectedRead });
  });

  it("el bloqueo va antes de reservar los correlativos", async () => {
    const { calls } = await runCase(create, createWith());
    const position = (name: string) =>
      calls.findIndex((call) => ("prisma" in call && call.prisma === name) || ("effect" in call && call.effect === name));

    expect(position("$queryRaw")).toBeGreaterThanOrEqual(0);
    expect(position("$queryRaw")).toBeLessThan(position("getNextCorrelativeId"));
  });

  it("el alta no pide las versiones de la receta que ya no usa", async () => {
    const { calls } = await runCase(create, createWith());
    const recipeRead = calls.find((call) => "prisma" in call && call.prisma === "receta_tecnica.findFirst") as
      | { args: { include?: unknown } }
      | undefined;

    expect(recipeRead?.args.include).toBeUndefined();
  });
});

// B6: marcar y anular se usan desde la fila con ConfirmActionButton: responden con
// un resultado, nunca redirigen ni lanzan, y un fallo interno no llega a la pantalla.
describe("marcar vigente y anular responden con resultado", () => {
  const writes = (calls: unknown[]) =>
    (calls as { prisma?: string }[]).filter((call) => /\.(update|updateMany|create)/.test(call.prisma ?? ""));
  const revalidations = (calls: unknown[]) =>
    (calls as { effect?: string }[]).filter((call) => call.effect === "revalidatePath");
  const failure = (mensaje: string) => ({
    estado: { status: "error", error: mensaje, values: { id: VERSION }, operationId: "operacion-de-prueba" },
  });

  it("marcar deja el estado que quedo y revalida", async () => {
    const { calls, result } = await runCase(setCurrent, { form: statusForm, data: versions("reemplazada") });

    expect(result).toEqual({
      estado: { status: "success", data: { estado: "vigente" }, values: { id: VERSION }, operationId: "operacion-de-prueba" },
    });
    expect(revalidations(calls).length).toBeGreaterThan(0);
  });

  it("anular deja el estado que quedo y revalida", async () => {
    const { calls, result } = await runCase(voidVersion, { form: statusForm, data: versions("reemplazada") });

    expect(result).toEqual({
      estado: { status: "success", data: { estado: "anulada" }, values: { id: VERSION }, operationId: "operacion-de-prueba" },
    });
    expect(revalidations(calls).length).toBeGreaterThan(0);
  });

  it.each([
    ["marcar", setCurrent],
    ["anular", voidVersion],
  ])("%s sin permiso responde con un error", async (_name, run) => {
    const { result } = await runCase(run, { form: statusForm, data: versions("reemplazada"), role: "SELLER" });

    expect(result).toEqual(failure("No tienes permisos para cambiar las versiones de receta."));
  });

  it("la que ya es vigente lo dice y no escribe", async () => {
    const { calls, result } = await runCase(setCurrent, { form: statusForm, data: versions("vigente") });

    expect(result).toEqual(failure("La versión ya estaba vigente."));
    expect(writes(calls)).toEqual([]);
    expect(revalidations(calls)).toEqual([]);
  });

  it("un rechazo no revalida", async () => {
    const { calls, result } = await runCase(voidVersion, { form: statusForm, data: versions("anulada") });

    expect(result).toEqual(failure("La versión ya se encuentra anulada."));
    expect(revalidations(calls)).toEqual([]);
  });

  it("un fallo al marcar no muestra el error interno", async () => {
    const { result } = await runCase(setCurrent, {
      form: statusForm,
      data: { ...versions("reemplazada"), "version_receta.update": failWith(new Error("conexion perdida")) },
    });

    expect(result).toEqual(failure("No se pudo marcar la versión como vigente. Intenta nuevamente."));
  });

  it("un fallo al anular no muestra el error interno", async () => {
    const { result } = await runCase(voidVersion, {
      form: statusForm,
      data: { ...versions("reemplazada"), "version_receta.update": failWith(new Error("conexion perdida")) },
    });

    expect(result).toEqual(failure("No se pudo anular la versión. Intenta nuevamente."));
  });
});

// B7: el alta devuelve el resultado al formulario, con cada error en su linea por su
// posicion (detalles.<posicion>.<campo>) y lo enviado, para no perderlo.
describe("el alta responde con resultado", () => {
  const stateOf = async (actionCase: Omit<ActionCase, "name">) =>
    ((await runCase(create, actionCase)).result as { estado: Record<string, unknown> }).estado;
  const writes = (calls: unknown[]) =>
    (calls as { prisma?: string }[]).filter((call) => /\.(update|updateMany|create|createMany)$/.test(call.prisma ?? ""));

  it("con exito devuelve el id y revalida tambien los materiales de la version", async () => {
    const { calls, result } = await runCase(create, createWith());

    expect((result as { estado: unknown }).estado).toMatchObject({
      status: "success",
      data: { id_version_receta: "VER00000012" },
    });
    expect(calls).toContainEqual(
      expect.objectContaining({
        effect: "revalidatePath",
        args: "/dashboard/production/recipes/REC00000003/versions/VER00000012/details",
      }),
    );
  });

  it("sin permiso responde con un error y lo enviado", async () => {
    expect(await stateOf({ ...createWith(), role: "SELLER" })).toMatchObject({
      status: "error",
      error: "No tienes permisos para cambiar las versiones de receta.",
      values: { id_receta: RECETA, motivo_cambio: "Cambio de proveedor" },
    });
  });

  it("devuelve las lineas tal como se enviaron", async () => {
    const state = await stateOf(createWith({ cantidad_requerida: ["abc", "1"] }));

    expect(state.values).toMatchObject({
      detalles: [
        {
          id_material: ACERO,
          cantidad_requerida: "abc",
          tipo_consumo: "materia_prima",
          merma_estimada_porcentaje: "5",
          observaciones: "",
        },
        {
          id_material: PINTURA,
          cantidad_requerida: "1",
          tipo_consumo: "consumible",
          merma_estimada_porcentaje: "0",
          observaciones: "Solo primera mano",
        },
      ],
    });
  });

  it("cada error lleva la posicion de su linea", async () => {
    const state = await stateOf(createWith({ cantidad_requerida: ["0", "-1"], tipo_consumo: ["otro", "consumible"] }));

    expect(state).toMatchObject({
      status: "error",
      error: "Revisa los datos de la versión.",
      fieldErrors: {
        "detalles.0.cantidad_requerida": ["La cantidad requerida debe ser de al menos 0.01."],
        "detalles.0.tipo_consumo": ["Seleccione un tipo de consumo válido."],
        "detalles.1.cantidad_requerida": ["La cantidad requerida debe ser de al menos 0.01."],
      },
    });
  });

  it("un material repetido se marca en cada linea que lo usa", async () => {
    const message = "No se permite duplicar materiales dentro de la versión.";
    const state = await stateOf(createWith({ id_material: [ACERO, ACERO] }));

    expect(state.fieldErrors).toEqual({
      "detalles.0.id_material": [message],
      "detalles.1.id_material": [message],
    });
  });

  it("sin lineas el mensaje de la lista sale como error general", async () => {
    expect(await stateOf(createWith({ id_material: null }))).toMatchObject({
      error: "Debe registrar al menos un material en la versión.",
    });
  });

  it("sin receta el mensaje del campo oculto sale como error general", async () => {
    expect(await stateOf(createWith({ id_receta: null }))).toMatchObject({
      error: "La receta técnica es obligatoria.",
    });
  });

  it("un material inactivo o inexistente se marca en su linea y no escribe (R4)", async () => {
    const { calls, result } = await runCase(create, createWith({}, materials(ACERO)));

    expect((result as { estado: unknown }).estado).toMatchObject({
      status: "error",
      error: "Uno o más materiales seleccionados no existen o están inactivos.",
      fieldErrors: { "detalles.1.id_material": ["El material seleccionado no existe o está inactivo."] },
    });
    expect(writes(calls)).toEqual([]);
  });

  it("una decision con la receta bloqueada responde y no escribe", async () => {
    const { calls, result } = await runCase(create, createWith({}, activeRecipe(false)));

    expect((result as { estado: unknown }).estado).toMatchObject({
      status: "error",
      error: "La receta técnica no existe o está inactiva.",
    });
    expect(writes(calls)).toEqual([]);
  });

  it("un fallo interno no llega a la pantalla", async () => {
    const state = await stateOf(createWith({}, { "version_receta.create": failWith(uniqueViolation()) }));

    expect(state.error).toBe("No se pudo crear la versión. Intenta nuevamente.");
  });
});

// B2 (hallazgo 4 de la auditoria de la 10.6): fecha_version es @db.Date, asi que
// dos versiones del mismo dia empatan; decide el correlativo, que siempre crece.
describe("el reemplazo de la vigente anulada", () => {
  it("con la misma fecha promueve la de correlativo mas alto", async () => {
    const { calls } = await runCase(voidVersion, { form: statusForm, data: versions("vigente") });
    const replacementRead = calls.find(
      (call) =>
        "prisma" in call &&
        call.prisma === "version_receta.findFirst" &&
        (call.args as { orderBy?: unknown }).orderBy !== undefined,
    ) as { args: { orderBy: unknown } } | undefined;

    expect(replacementRead?.args.orderBy).toEqual([{ fecha_version: "desc" }, { id_version_receta: "desc" }]);
  });
});
