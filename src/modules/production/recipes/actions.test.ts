import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import type { StatusToggleState } from "@/lib/requested-status";
import {
  createTechnicalRecipeAction,
  toggleTechnicalRecipeStatusAction,
  type TechnicalRecipeFormState,
} from "@/modules/production/recipes/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de recetas tecnicas (entrega 10.6b),
// escrita antes de llevarlas al bloqueo de fila, al resultado de accion y a su
// superficie. Cada caso ejecuta la accion real con Prisma, la sesion, la cache,
// la bitacora y los correlativos simulados, y fija en un snapshot, en orden: la
// autorizacion con sus roles, las lecturas, la transaccion con sus escrituras y
// su final, los correlativos, la bitacora, las revalidaciones y el resultado.
//
// Desde el panel lateral (B4), las dos acciones autorizan con getAuthorizedSession
// y devuelven el resultado en lugar de lanzar y redirigir: sin permiso responden con
// un error. Activar e inactivar comparan y escriben en una sola sentencia.

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
const PRODUCTO = "PRO00000004";
const DUPLICATE = "Ya existe una receta con ese nombre para este producto.";

const initialState: TechnicalRecipeFormState = { status: "idle" };
const create = (formData: FormData) => createTechnicalRecipeAction(initialState, formData);

const initialToggleState: StatusToggleState = { status: "idle" };
const toggle = (formData: FormData) => toggleTechnicalRecipeStatusAction(initialToggleState, formData);

const form: FormFields = {
  id_producto: PRODUCTO,
  nombre_receta: "Receta estandar de lampa",
  descripcion: "Materiales principales",
};

const product = (exists = true): DataOverrides => ({
  "producto.findFirst": exists ? { id_producto: PRODUCTO, nombre_producto: "Lampa" } : null,
});

const noDuplicate: DataOverrides = { "receta_tecnica.findFirst": null };
const duplicate: DataOverrides = { "receta_tecnica.findFirst": { id_receta: "REC00000009" } };

const createWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...form, ...fields },
  data: { ...product(), ...noDuplicate, ...data },
});

// El estado pedido, que el boton envia; la base devuelve la fila que cambio.
const toggleOf = (estado: boolean, data: DataOverrides = {}) => ({
  form: { id_receta: RECETA, estado: String(estado) },
  data: { "receta_tecnica.updateManyAndReturn": [{ id_receta: RECETA }], ...data },
});

const alreadyThere = toggleOf(false, {
  "receta_tecnica.updateManyAndReturn": [],
  "receta_tecnica.findUnique": { id_receta: RECETA },
});

const missing = toggleOf(false, {
  "receta_tecnica.updateManyAndReturn": [],
  "receta_tecnica.findUnique": null,
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createTechnicalRecipeAction", create, [
  { name: "ADMIN crea la receta activa con su correlativo y la bitacora en la transaccion", ...createWith() },
  { name: "WORKSHOP_MASTER tambien crea recetas", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...createWith(), role: "SELLER" },
  { name: "la descripcion vacia se guarda como null", ...createWith({ descripcion: "" }) },
  { name: "la descripcion ausente cuenta como vacia", ...createWith({ descripcion: null }) },
  { name: "datos invalidos devuelven errores por campo sin tocar Prisma", ...createWith({ nombre_receta: "ab" }) },
  { name: "sin producto devuelve su error", ...createWith({ id_producto: "" }) },
  { name: "un POST sin campos devuelve errores sin tocar Prisma", form: {} },
  { name: "el producto no existe o esta inactivo", ...createWith({}, product(false)) },
  { name: "ya existe una receta con ese nombre para el producto", ...createWith({}, duplicate) },
  {
    name: "una carrera por el nombre (P2002) responde como el duplicado",
    ...createWith({}, { "receta_tecnica.create": failWith(uniqueViolation()) }),
  },
  {
    name: "un fallo al crear revierte y responde con un error general",
    ...createWith({}, { "receta_tecnica.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("toggleTechnicalRecipeStatusAction", toggle, [
  { name: "una receta activa se inactiva", ...toggleOf(false) },
  { name: "una receta inactiva se activa", ...toggleOf(true) },
  { name: "WORKSHOP_MASTER tambien cambia el estado", ...toggleOf(false), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...toggleOf(false), role: "SELLER" },
  { name: "sin id devuelve su error sin tocar Prisma", form: { estado: "false" } },
  { name: "sin estado pedido devuelve su error sin tocar Prisma", form: { id_receta: RECETA } },
  { name: "ya tenia ese estado", ...alreadyThere },
  { name: "la receta no existe", ...missing },
  {
    name: "un fallo al escribir revierte y responde con un error general",
    ...toggleOf(false, { "receta_tecnica.updateManyAndReturn": failWith(new Error("conexion perdida")) }),
  },
]);

// B4: cada mensaje que antes se perdia en la pagina de error llega al formulario,
// junto al campo que lo causa, con lo escrito y sin redirigir.
describe("el alta devuelve el resultado al formulario", () => {
  const stateOf = async (actionCase: Omit<ActionCase, "name">) =>
    ((await runCase(create, actionCase)).result as { estado: TechnicalRecipeFormState }).estado;

  it("con exito devuelve el id y no redirige", async () => {
    expect(await stateOf(createWith())).toMatchObject({ status: "success", data: { id_receta: "REC00000012" } });
  });

  it.each([
    ["el producto", createWith({}, product(false)), "id_producto", "El producto seleccionado no existe o está inactivo."],
    ["el nombre", createWith({}, duplicate), "nombre_receta", DUPLICATE],
    ["una carrera", createWith({}, { "receta_tecnica.create": failWith(uniqueViolation()) }), "nombre_receta", DUPLICATE],
  ])("%s deja el error junto al campo y conserva lo escrito", async (_name, actionCase, field, message) => {
    expect(await stateOf(actionCase)).toMatchObject({
      status: "error",
      error: message,
      fieldErrors: { [field]: [message] },
      values: { nombre_receta: form.nombre_receta, descripcion: form.descripcion },
    });
  });

  it("otro fallo no se presenta como duplicado ni muestra el error interno", async () => {
    const state = await stateOf(createWith({}, { "receta_tecnica.create": failWith(new Error("conexion perdida")) }));

    expect(state).toMatchObject({ status: "error", error: "No se pudo guardar la receta. Intenta nuevamente." });
    expect(state).not.toHaveProperty("fieldErrors.nombre_receta");
  });

  it("un POST sin campos responde en espanol", async () => {
    expect(await stateOf({ form: {} })).toMatchObject({
      status: "error",
      error: "Revisa los datos de la receta.",
      fieldErrors: {
        id_producto: ["Seleccione un producto."],
        nombre_receta: ["El nombre de la receta debe tener al menos 3 caracteres."],
      },
    });
  });
});

// B4: compara y escribe en una sola sentencia, asi que una lista desactualizada o
// un doble clic nunca hacen lo contrario de lo que dice el boton.
describe("activar e inactivar una receta", () => {
  type Recorded = { prisma?: string; args?: { where?: unknown; data?: unknown } };

  const write = async (actionCase: Omit<ActionCase, "name">) =>
    ((await runCase(toggle, actionCase)).calls as Recorded[]).find(
      (call) => call.prisma === "receta_tecnica.updateManyAndReturn",
    )?.args;

  const stateOf = async (actionCase: Omit<ActionCase, "name">) =>
    ((await runCase(toggle, actionCase)).result as { estado: StatusToggleState }).estado;

  it("inactivar solo cambia una receta activa", async () => {
    expect(await write(toggleOf(false))).toMatchObject({
      where: { id_receta: RECETA, estado: "activa" },
      data: { estado: "inactiva" },
    });
  });

  it("activar solo cambia una receta inactiva", async () => {
    expect(await write(toggleOf(true))).toMatchObject({
      where: { id_receta: RECETA, estado: "inactiva" },
      data: { estado: "activa" },
    });
  });

  it("devuelve el estado que quedo", async () => {
    expect(await stateOf(toggleOf(false))).toMatchObject({ status: "success", data: { estado: false } });
    expect(await stateOf(toggleOf(true))).toMatchObject({ status: "success", data: { estado: true } });
  });

  it("si ya tenia ese estado lo dice y no deja rastro en la bitacora", async () => {
    const { calls, result } = await runCase(toggle, alreadyThere);

    expect(result).toMatchObject({ estado: { status: "error", error: "La receta ya estaba inactiva." } });
    expect(calls).not.toContainEqual(expect.objectContaining({ effect: "registerAuditLog" }));
  });

  it("si no existe lo dice", async () => {
    expect(await stateOf(missing)).toMatchObject({ status: "error", error: "La receta técnica seleccionada no existe." });
  });
});
