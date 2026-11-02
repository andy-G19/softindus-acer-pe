import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createRecipeDetailAction,
  deleteRecipeDetailAction,
  updateRecipeDetailAction,
  type RecipeDetailDeleteState,
  type RecipeDetailFormState,
} from "@/modules/production/recipe-details/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de detalles de receta (entrega 10.6b),
// escrita antes de llevarlas al bloqueo de fila, al resultado de accion y a su
// superficie. Cada caso ejecuta la accion real con Prisma, la sesion, la cache,
// la bitacora y los correlativos simulados, y fija en un snapshot, en orden: la
// autorizacion con sus roles, las lecturas, la transaccion con sus escrituras y
// su final, los correlativos, la bitacora, las revalidaciones y el resultado.
//
// Desde el panel lateral (B5), las tres acciones autorizan con getAuthorizedSession
// y devuelven el resultado en lugar de lanzar y redirigir: sin permiso responden con
// un error.

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
  "version_receta.findUnique": options.exists === false ? null : { id_receta: RECETA },
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
          id_material: MATERIAL,
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

const idle: RecipeDetailFormState = { status: "idle" };
const idleDelete: RecipeDetailDeleteState = { status: "idle" };
const create = (formData: FormData) => createRecipeDetailAction(idle, formData);
const update = (formData: FormData) => updateRecipeDetailAction(idle, formData);
const remove = (formData: FormData) => deleteRecipeDetailAction(idleDelete, formData);

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createRecipeDetailAction", create, [
  { name: "ADMIN agrega el material con la unidad del inventario", ...createWith() },
  { name: "WORKSHOP_MASTER tambien agrega", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...createWith(), role: "SELLER" },
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
    name: "una carrera (P2002) responde como el duplicado",
    ...createWith({}, { "detalle_receta.create": failWith(uniqueViolation()) }),
  },
]);

defineCases("updateRecipeDetailAction", update, [
  { name: "ADMIN actualiza la linea con la unidad del inventario", ...updateWith() },
  { name: "WORKSHOP_MASTER tambien actualiza", ...updateWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...updateWith(), role: "SELLER" },
  { name: "sin id devuelve su mensaje sin tocar Prisma", ...updateWith({ id_detalle_receta: "" }) },
  { name: "datos invalidos devuelven errores por campo", ...updateWith({ cantidad_requerida: "0" }) },
  { name: "la linea no existe", ...updateWith({}, detail(null)) },
  { name: "la linea es de otra version", ...updateWith({}, detail("VER00000099")) },
  { name: "la version no existe o no esta vigente", ...updateWith({}, version({ exists: false })) },
  { name: "la receta no esta activa", ...updateWith({}, version({ receta: "inactiva" })) },
  { name: "la version ya la usan ordenes", ...updateWith({}, version({ orders: 1 })) },
  { name: "un material que ya no existe se rechaza", ...updateWith({}, material(false)) },
  { name: "otra linea ya usa ese material", ...updateWith({}, duplicate) },
  {
    name: "una carrera (P2002) responde como el duplicado",
    ...updateWith({}, { "detalle_receta.update": failWith(uniqueViolation()) }),
  },
]);

defineCases("deleteRecipeDetailAction", remove, [
  { name: "ADMIN elimina la linea", ...deleteWith() },
  { name: "WORKSHOP_MASTER tambien elimina", ...deleteWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...deleteWith(), role: "SELLER" },
  { name: "sin id devuelve su error sin tocar Prisma", form: {} },
  { name: "la linea no existe", ...deleteWith(detail(null)) },
  { name: "la version no existe o no esta vigente", ...deleteWith(version({ exists: false })) },
  { name: "la receta no esta activa", ...deleteWith(version({ receta: "inactiva" })) },
  { name: "la version ya la usan ordenes", ...deleteWith(version({ orders: 1 })) },
  {
    name: "un fallo al borrar revierte y responde con un error general",
    ...deleteWith({ "detalle_receta.delete": failWith(new Error("conexion perdida")) }),
  },
]);

// B2 (hallazgo 1 de la auditoria de la 10.6): una linea no tiene candado propio;
// se bloquea la receta de su version, que no cambia, y todo lo que decide se lee
// despues. Asi agregar, editar y borrar se ordenan con marcar vigente y anular.
describe("las acciones de detalles deciden con la receta bloqueada", () => {
  const protectedRead = (call: { prisma: string }) =>
    call.prisma === "version_receta.findFirst" ||
    call.prisma === "detalle_receta.findFirst" ||
    call.prisma === "material.findFirst";

  // La primera lectura de la linea solo busca su version, para saber que receta
  // bloquear; la que decide trae el material.
  const deciding = (call: { prisma: string; args?: unknown }) =>
    protectedRead(call) ||
    (call.prisma === "detalle_receta.findUnique" && (call.args as { include?: unknown }).include !== undefined);

  it.each([
    ["el alta que acepta", create, createWith()],
    ["el alta de un duplicado", create, createWith({}, duplicate)],
    ["el alta en una version usada", create, createWith({}, version({ orders: 1 }))],
    ["la edicion que acepta", update, updateWith()],
    ["la edicion en una version usada", update, updateWith({}, version({ orders: 1 }))],
  ])("%s bloquea antes de leer", async (_name, run, actionCase) => {
    const { calls } = await runCase(run, actionCase);

    expectRowLockedBefore(calls, { table: "receta_tecnica", id: RECETA, reads: protectedRead });
  });

  it("la edicion lee la linea con la receta ya bloqueada", async () => {
    const { calls } = await runCase(update, updateWith());

    expectRowLockedBefore(calls, {
      table: "receta_tecnica",
      id: RECETA,
      reads: (call) => call.prisma === "detalle_receta.findUnique",
    });
  });

  it.each([
    ["que acepta", deleteWith()],
    ["en una version usada", deleteWith(version({ orders: 1 }))],
  ])("el borrado %s bloquea antes de decidir", async (_name, actionCase) => {
    const { calls } = await runCase(remove, actionCase);

    expectRowLockedBefore(calls, { table: "receta_tecnica", id: RECETA, reads: deciding });
  });

  it("si otro borro la linea mientras esperaba, responde que no existe y no borra", async () => {
    let reads = 0;
    const { calls, result } = await runCase(
      remove,
      deleteWith({
        "detalle_receta.findUnique": () => {
          reads += 1;

          return reads === 1
            ? { id_detalle_receta: DETALLE, id_version_receta: VERSION, material: { nombre_material: "Plancha de acero" } }
            : null;
        },
      }),
    );

    expect(result).toMatchObject({ estado: { status: "error", error: "El material de la receta no existe." } });
    expect(calls).not.toContainEqual(expect.objectContaining({ prisma: "detalle_receta.delete" }));
  });
});

// B3 (hallazgo 3 de la auditoria de la 10.6): la consulta ofrece el material de la
// linea aunque este inactivo, y la accion lo rechazaba: no se podia corregir ni la
// cantidad. Como en pedidos, el actual se conserva y uno nuevo debe estar activo.
describe("el material inactivo al editar", () => {
  const OTRO_MATERIAL = "MAT00000002";
  const INACTIVO = "El material seleccionado no existe o está inactivo.";

  const inactiveMaterial: DataOverrides = {
    "material.findFirst": (args) =>
      (args as { where: { estado?: boolean } }).where.estado === true
        ? null
        : { id_material: MATERIAL, nombre_material: "Plancha de acero", unidad_medida: "kg" },
  };

  it("el de la linea se conserva y se puede guardar", async () => {
    const { calls, result } = await runCase(update, updateWith({}, inactiveMaterial));

    expect(result).toMatchObject({ estado: { status: "success", data: { id_detalle_receta: DETALLE } } });
    expect(calls).toContainEqual(expect.objectContaining({ prisma: "detalle_receta.update" }));
  });

  it("cambiar a otro inactivo se rechaza", async () => {
    const { calls, result } = await runCase(
      update,
      updateWith({ id_material: OTRO_MATERIAL }, inactiveMaterial),
    );

    expect(result).toMatchObject({ estado: { error: INACTIVO, fieldErrors: { id_material: [INACTIVO] } } });
    expect(calls).not.toContainEqual(expect.objectContaining({ prisma: "detalle_receta.update" }));
  });

  it("el alta sigue exigiendo un material activo", async () => {
    const { result } = await runCase(create, createWith({}, inactiveMaterial));

    expect(result).toMatchObject({ estado: { error: INACTIVO, fieldErrors: { id_material: [INACTIVO] } } });
  });
});

// B5: cada mensaje llega al formulario, junto a su campo y con lo escrito.
describe("el alta y la edicion devuelven el resultado al formulario", () => {
  const DUPLICADO = "Este material ya está registrado en esta versión de receta.";

  const stateOf = async (run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">) =>
    ((await runCase(run, actionCase)).result as { estado: RecipeDetailFormState }).estado;

  it("con exito devuelve el id y no redirige", async () => {
    expect(await stateOf(create, createWith())).toMatchObject({
      status: "success",
      data: { id_detalle_receta: "DRE00000012" },
    });
    expect(await stateOf(update, updateWith())).toMatchObject({
      status: "success",
      data: { id_detalle_receta: DETALLE },
    });
  });

  it.each([
    ["el alta", create, createWith({}, { "detalle_receta.create": failWith(uniqueViolation()) })],
    ["la edicion", update, updateWith({}, { "detalle_receta.update": failWith(uniqueViolation()) })],
  ])("una carrera en %s responde como el duplicado", async (_name, run, actionCase) => {
    expect(await stateOf(run, actionCase)).toMatchObject({
      status: "error",
      error: DUPLICADO,
      fieldErrors: { id_material: [DUPLICADO] },
    });
  });

  it("otro fallo no muestra el error interno", async () => {
    expect(
      await stateOf(create, createWith({}, { "detalle_receta.create": failWith(new Error("conexion perdida")) })),
    ).toMatchObject({ status: "error", error: "No se pudo guardar el material. Intenta nuevamente." });
  });

  it("un rechazo conserva lo escrito", async () => {
    expect(await stateOf(create, createWith({}, duplicate))).toMatchObject({
      status: "error",
      values: {
        id_material: MATERIAL,
        cantidad_requerida: "2.5",
        merma_estimada_porcentaje: "5",
        tipo_consumo: "materia_prima",
        observaciones: "Plancha entera",
      },
    });
  });

  it("los errores de validacion quedan por campo", async () => {
    expect(await stateOf(create, createWith({ cantidad_requerida: "0.001" }))).toMatchObject({
      status: "error",
      error: "Revisa los datos del material.",
      fieldErrors: { cantidad_requerida: ["La cantidad requerida debe ser de al menos 0.01."] },
    });
  });
});

describe("eliminar una linea devuelve el resultado", () => {
  it("con exito devuelve el id", async () => {
    const { result } = await runCase(remove, deleteWith());

    expect(result).toMatchObject({
      estado: { status: "success", data: { id_detalle_receta: DETALLE }, values: { id_detalle_receta: DETALLE } },
    });
  });

  it("un rechazo deja su mensaje", async () => {
    const { result } = await runCase(remove, deleteWith(version({ receta: "inactiva" })));

    expect(result).toMatchObject({ estado: { status: "error", error: "La receta técnica no está activa." } });
  });

  it("un fallo no muestra el error interno", async () => {
    const { result } = await runCase(
      remove,
      deleteWith({ "detalle_receta.delete": failWith(new Error("conexion perdida")) }),
    );

    expect(result).toMatchObject({
      estado: { status: "error", error: "No se pudo eliminar el material. Intenta nuevamente." },
    });
  });
});
