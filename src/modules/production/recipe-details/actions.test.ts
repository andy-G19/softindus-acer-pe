import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createRecipeDetailAction,
  deleteRecipeDetailAction,
  updateRecipeDetailAction,
} from "@/modules/production/recipe-details/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de detalles de receta (entrega 10.6b),
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
const DETALLE = "DRE00000007";
const MATERIAL = "MAT00000001";

const form: FormFields = {
  id_version_receta: VERSION,
  id_material: MATERIAL,
  cantidad_requerida: "2.5",
  tipo_consumo: "materia_prima",
  merma_estimada_porcentaje: "5",
  observaciones: "Plancha entera",
};

const version = (
  options: { exists?: boolean; receta?: string; orders?: number } = {},
): DataOverrides => ({
  "version_receta.findFirst":
    options.exists === false
      ? null
      : {
          id_version_receta: VERSION,
          id_receta: RECETA,
          estado: "vigente",
          receta_tecnica: { id_receta: RECETA, estado: options.receta ?? "activa" },
          orden_trabajo: Array.from({ length: options.orders ?? 0 }, () => ({ id_orden_trabajo: "OTR00000001" })),
        },
});

const material = (exists = true): DataOverrides => ({
  "material.findFirst": exists
    ? { id_material: MATERIAL, nombre_material: "Plancha de acero", unidad_medida: "kg" }
    : null,
});

const noDuplicate: DataOverrides = { "detalle_receta.findFirst": null };
const duplicate: DataOverrides = { "detalle_receta.findFirst": { id_detalle_receta: "DRE00000009" } };

const detail = (idVersion: string | null = VERSION): DataOverrides => ({
  "detalle_receta.findUnique":
    idVersion === null
      ? null
      : {
          id_detalle_receta: DETALLE,
          id_version_receta: idVersion,
          material: { nombre_material: "Plancha de acero" },
        },
});

const createWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...form, ...fields },
  data: { ...version(), ...material(), ...noDuplicate, ...data },
});

const updateWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...form, id_detalle_receta: DETALLE, ...fields },
  data: { ...detail(), ...version(), ...material(), ...noDuplicate, ...data },
});

const deleteWith = (data: DataOverrides = {}) => ({
  form: { id_detalle_receta: DETALLE },
  data: { ...detail(), ...version(), ...data },
});

const withState =
  (action: (state: { error: string }, formData: FormData) => Promise<unknown>) => (formData: FormData) =>
    action({ error: "" }, formData);

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createRecipeDetailAction", withState(createRecipeDetailAction), [
  { name: "ADMIN agrega el material con la unidad del inventario", ...createWith() },
  { name: "WORKSHOP_MASTER tambien agrega", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", ...createWith(), role: "SELLER" },
  {
    name: "sin merma ni observaciones se guarda null",
    ...createWith({ merma_estimada_porcentaje: "", observaciones: "" }),
  },
  {
    name: "datos invalidos devuelven errores por campo",
    ...createWith({ cantidad_requerida: "0", tipo_consumo: "otro" }),
  },
  { name: "una merma fuera de rango devuelve su error", ...createWith({ merma_estimada_porcentaje: "101" }) },
  { name: "la version no existe o no esta vigente", ...createWith({}, version({ exists: false })) },
  { name: "la receta no esta activa", ...createWith({}, version({ receta: "inactiva" })) },
  { name: "la version ya la usan ordenes", ...createWith({}, version({ orders: 1 })) },
  { name: "el material no existe o esta inactivo", ...createWith({}, material(false)) },
  { name: "el material ya esta en la version", ...createWith({}, duplicate) },
  {
    name: "una carrera (P2002) deja el error de Prisma",
    ...createWith({}, { "detalle_receta.create": failWith(uniqueViolation()) }),
  },
]);

defineCases("updateRecipeDetailAction", withState(updateRecipeDetailAction), [
  { name: "ADMIN actualiza la linea con la unidad del inventario", ...updateWith() },
  { name: "WORKSHOP_MASTER tambien actualiza", ...updateWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", ...updateWith(), role: "SELLER" },
  { name: "sin id devuelve su mensaje sin tocar Prisma", ...updateWith({ id_detalle_receta: "" }) },
  { name: "datos invalidos devuelven errores por campo", ...updateWith({ cantidad_requerida: "0" }) },
  { name: "la linea no existe", ...updateWith({}, detail(null)) },
  { name: "la linea es de otra version", ...updateWith({}, detail("VER00000099")) },
  { name: "la version no existe o no esta vigente", ...updateWith({}, version({ exists: false })) },
  { name: "la receta no esta activa", ...updateWith({}, version({ receta: "inactiva" })) },
  { name: "la version ya la usan ordenes", ...updateWith({}, version({ orders: 1 })) },
  { name: "un material inactivo se rechaza, aunque sea el de la linea", ...updateWith({}, material(false)) },
  { name: "otra linea ya usa ese material", ...updateWith({}, duplicate) },
  {
    name: "una carrera (P2002) deja el error de Prisma",
    ...updateWith({}, { "detalle_receta.update": failWith(uniqueViolation()) }),
  },
]);

defineCases("deleteRecipeDetailAction", deleteRecipeDetailAction, [
  { name: "ADMIN elimina la linea", ...deleteWith() },
  { name: "WORKSHOP_MASTER tambien elimina", ...deleteWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", ...deleteWith(), role: "SELLER" },
  { name: "sin id lanza su mensaje sin tocar Prisma", form: {} },
  { name: "la linea no existe", ...deleteWith(detail(null)) },
  { name: "la version no existe o no esta vigente", ...deleteWith(version({ exists: false })) },
  { name: "la receta no esta activa", ...deleteWith(version({ receta: "inactiva" })) },
  { name: "la version ya la usan ordenes", ...deleteWith(version({ orders: 1 })) },
  {
    name: "un fallo al borrar revierte y deja el error",
    ...deleteWith({ "detalle_receta.delete": failWith(new Error("conexion perdida")) }),
  },
]);
