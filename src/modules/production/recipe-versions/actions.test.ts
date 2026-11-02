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

defineCases("createRecipeVersionAction", createRecipeVersionAction, [
  { name: "ADMIN crea la version vigente y reemplaza la anterior", ...createWith() },
  { name: "WORKSHOP_MASTER tambien crea versiones", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", ...createWith(), role: "SELLER" },
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
  { name: "sin lineas une su mensaje", ...createWith({ id_material: null }) },
  {
    name: "varios errores se unen en un mensaje",
    ...createWith({ cantidad_requerida: ["0", "-1"], tipo_consumo: ["otro", "consumible"] }),
  },
  { name: "un material repetido se rechaza", ...createWith({ id_material: [ACERO, ACERO] }) },
  { name: "un material vacio se rechaza", ...createWith({ id_material: [ACERO, ""] }) },
  { name: "la receta no existe o esta inactiva", ...createWith({}, activeRecipe(false)) },
  { name: "un material no existe o esta inactivo", ...createWith({}, materials(ACERO)) },
  {
    name: "una carrera (P2002) deja el error de Prisma",
    ...createWith({}, { "version_receta.create": failWith(uniqueViolation()) }),
  },
  {
    name: "un fallo en las lineas revierte y deja el error",
    ...createWith({}, { "detalle_receta.createMany": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("setCurrentRecipeVersionAction", setCurrentRecipeVersionAction, [
  {
    name: "una reemplazada pasa a vigente y la vigente queda reemplazada",
    form: statusForm,
    data: versions("reemplazada"),
  },
  { name: "WORKSHOP_MASTER tambien la marca", form: statusForm, data: versions("reemplazada"), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", form: statusForm, data: versions("reemplazada"), role: "SELLER" },
  { name: "sin receta lanza su mensaje sin tocar Prisma", form: { id_version_receta: VERSION } },
  { name: "sin version lanza su mensaje sin tocar Prisma", form: { id_receta: RECETA } },
  { name: "la version no existe", form: statusForm, data: versions(null) },
  { name: "la receta no esta activa", form: statusForm, data: versions("reemplazada", { receta: "inactiva" }) },
  { name: "una anulada no se puede marcar", form: statusForm, data: versions("anulada") },
  { name: "la que ya es vigente redirige sin escribir", form: statusForm, data: versions("vigente") },
  {
    name: "un fallo al escribir revierte y deja el error",
    form: statusForm,
    data: { ...versions("reemplazada"), "version_receta.update": failWith(new Error("conexion perdida")) },
  },
]);

defineCases("voidRecipeVersionAction", voidRecipeVersionAction, [
  { name: "una reemplazada se anula", form: statusForm, data: versions("reemplazada") },
  { name: "la vigente se anula y promueve la mas reciente no anulada", form: statusForm, data: versions("vigente") },
  { name: "WORKSHOP_MASTER tambien anula", form: statusForm, data: versions("reemplazada"), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", form: statusForm, data: versions("reemplazada"), role: "SELLER" },
  { name: "sin version lanza su mensaje sin tocar Prisma", form: { id_receta: RECETA } },
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
    expect(await written(createRecipeVersionAction, createWith())).toEqual([
      "version_receta.updateMany:reemplazada",
      "version_receta.create:vigente",
    ]);
  });

  it("marcar vigente reemplaza antes de promover", async () => {
    expect(await written(setCurrentRecipeVersionAction, { form: statusForm, data: versions("reemplazada") })).toEqual([
      "version_receta.updateMany:reemplazada",
      "version_receta.update:vigente",
    ]);
  });

  it("anular la vigente anula antes de promover", async () => {
    expect(await written(voidRecipeVersionAction, { form: statusForm, data: versions("vigente") })).toEqual([
      "version_receta.update:anulada",
      "version_receta.update:vigente",
    ]);
  });
});
