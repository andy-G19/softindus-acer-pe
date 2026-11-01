import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createFabricationRouteAction,
  toggleFabricationRouteStatusAction,
  updateFabricationRouteAction,
  type FabricationRouteFormState,
} from "@/modules/production/routes/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de rutas de fabricacion (entrega 10.6a),
// escrita antes de llevarlas al bloqueo de fila, al resultado de accion y al
// panel lateral. Cada caso ejecuta la accion real con Prisma, la sesion, la
// cache, la bitacora y los correlativos simulados, y fija en un snapshot, en
// orden: la autorizacion con sus roles, las lecturas, la transaccion con sus
// escrituras y su final, los correlativos, la bitacora, las revalidaciones y el
// resultado, con su mensaje exacto.
//
// Desde el panel lateral (A4), el alta y la edicion autorizan con
// getAuthorizedSession y devuelven el resultado (FormActionState) en lugar de
// lanzar y redirigir: sin permiso responden con un error dentro del formulario.

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

  return {
    ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
    getNextCorrelativeId: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string },
    ) => {
      recordEffect("getNextCorrelativeId", params);
      const next = (mocks.correlatives.get(params.prefijo) ?? 11) + 1;
      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
    },
  };
});

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

// null deja el campo fuera del formulario: formData.get devuelve null.
type FormFields = Record<string, string | null>;
type ActionCase = { name: string; form: FormFields; data?: DataOverrides; role?: Role };

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    if (value !== null) {
      formData.append(key, value);
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

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

const RUTA = "RUT00000003";
const PRODUCTO = "PRO00000004";
const OTRO_PRODUCTO = "PRO00000005";

const initialState: FabricationRouteFormState = { status: "idle" };
const create = (formData: FormData) => createFabricationRouteAction(initialState, formData);
const update = (formData: FormData) => updateFabricationRouteAction(initialState, formData);

const failWith = (error: Error) => () => {
  throw error;
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

const form: FormFields = {
  id_producto: PRODUCTO,
  nombre_ruta: "Ruta estandar para lampa",
  descripcion: "Corte, formado y pintura",
};

const product = (exists = true): DataOverrides => ({
  "producto.findFirst": exists ? { id_producto: PRODUCTO, nombre_producto: "Lampa" } : null,
});

const noDuplicate: DataOverrides = { "ruta_fabricacion.findFirst": null };
const duplicate: DataOverrides = {
  "ruta_fabricacion.findFirst": { id_ruta: "RUT00000009" },
};

const currentRoute = (orders: number, idProducto = PRODUCTO): DataOverrides => ({
  "ruta_fabricacion.findUnique": {
    id_ruta: RUTA,
    id_producto: idProducto,
    nombre_ruta: "Ruta anterior",
    estado: true,
    _count: { orden_trabajo: orders },
  },
});

const noRoute: DataOverrides = { "ruta_fabricacion.findUnique": null };

const createWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...form, ...fields },
  data: { ...product(), ...noDuplicate, ...data },
});

const updateWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...form, id_ruta: RUTA, ...fields },
  data: { ...currentRoute(0), ...product(), ...noDuplicate, ...data },
});

const toggleOf = (estado: boolean | null) => ({
  form: { id_ruta: RUTA },
  data:
    estado === null
      ? noRoute
      : {
          "ruta_fabricacion.findUnique": { id_ruta: RUTA, nombre_ruta: "Ruta de lampa", estado },
        },
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createFabricationRouteAction", create, [
  { name: "ADMIN crea la ruta activa con su correlativo y la bitacora en la transaccion", ...createWith() },
  { name: "WORKSHOP_MASTER tambien crea rutas", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...createWith(), role: "SELLER" },
  { name: "la descripcion vacia se guarda como null", ...createWith({ descripcion: "" }) },
  { name: "la descripcion ausente cuenta como vacia", ...createWith({ descripcion: null }) },
  { name: "datos invalidos devuelven los errores por campo sin tocar Prisma", ...createWith({ nombre_ruta: "ab" }) },
  { name: "sin producto devuelve su error", ...createWith({ id_producto: "" }) },
  { name: "un POST sin campos devuelve sus errores sin tocar Prisma", form: {} },
  { name: "el producto no existe o esta inactivo", ...createWith({}, product(false)) },
  { name: "ya existe una ruta con ese nombre para el producto", ...createWith({}, duplicate) },
  {
    name: "una carrera por el nombre (P2002) responde como el duplicado",
    ...createWith({}, { "ruta_fabricacion.create": failWith(uniqueViolation()) }),
  },
  {
    name: "un fallo al crear revierte con el mensaje generico",
    ...createWith({}, { "ruta_fabricacion.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("updateFabricationRouteAction", update, [
  { name: "ADMIN actualiza la ruta", ...updateWith() },
  { name: "WORKSHOP_MASTER tambien actualiza rutas", ...updateWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...updateWith(), role: "SELLER" },
  { name: "la descripcion vacia se guarda como null", ...updateWith({ descripcion: "" }) },
  { name: "sin id devuelve su error sin tocar Prisma", ...updateWith({ id_ruta: "" }) },
  { name: "datos invalidos devuelven los errores por campo sin tocar Prisma", ...updateWith({ nombre_ruta: "ab" }) },
  { name: "la ruta no existe", ...updateWith({}, noRoute) },
  {
    name: "sin ordenes se puede cambiar el producto",
    ...updateWith({ id_producto: OTRO_PRODUCTO }),
  },
  {
    name: "con ordenes no se puede cambiar el producto",
    ...updateWith({ id_producto: OTRO_PRODUCTO }, currentRoute(2)),
  },
  { name: "con ordenes se puede editar lo demas", ...updateWith({}, currentRoute(2)) },
  {
    name: "un producto nuevo que no existe o esta inactivo se rechaza",
    ...updateWith({ id_producto: OTRO_PRODUCTO }, product(false)),
  },
  {
    name: "el producto actual inactivo se conserva al editar lo demas",
    ...updateWith({}, product(false)),
  },
  {
    name: "con ordenes y el producto inactivo se puede editar lo demas",
    ...updateWith({}, { ...currentRoute(2), ...product(false) }),
  },
  { name: "otra ruta del producto ya usa ese nombre", ...updateWith({}, duplicate) },
  {
    name: "una carrera por el nombre (P2002) responde como el duplicado",
    ...updateWith({}, { "ruta_fabricacion.update": failWith(uniqueViolation()) }),
  },
]);

defineCases("toggleFabricationRouteStatusAction", toggleFabricationRouteStatusAction, [
  { name: "una ruta activa se inactiva", ...toggleOf(true) },
  { name: "una ruta inactiva se activa", ...toggleOf(false) },
  { name: "WORKSHOP_MASTER tambien cambia el estado", ...toggleOf(true), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", ...toggleOf(true), role: "SELLER" },
  { name: "sin id lanza su mensaje sin tocar Prisma", form: {} },
  { name: "la ruta no existe", ...toggleOf(null) },
  {
    name: "un fallo al escribir revierte y deja el error",
    form: toggleOf(true).form,
    data: { ...toggleOf(true).data, "ruta_fabricacion.update": failWith(new Error("conexion perdida")) },
  },
]);

// Lo que el alta y la edicion escriben, fuera del snapshot.
describe("las acciones de rutas escriben lo que reciben", () => {
  type Recorded = { prisma?: string; args?: { data?: Record<string, unknown>; where?: Record<string, unknown> } };

  async function written(
    run: (formData: FormData) => Promise<unknown>,
    actionCase: Omit<ActionCase, "name">,
    model: string,
  ) {
    const { calls } = await runCase(run, actionCase);

    return (calls as Recorded[]).find((call) => call.prisma === model)?.args;
  }

  it("el alta guarda la ruta activa con el correlativo", async () => {
    expect(
      (await written(create, createWith(), "ruta_fabricacion.create"))?.data,
    ).toEqual({
      id_ruta: "RUT00000012",
      id_producto: PRODUCTO,
      nombre_ruta: form.nombre_ruta,
      descripcion: form.descripcion,
      estado: true,
    });
  });

  it("la edicion no toca el estado", async () => {
    const args = await written(update, updateWith(), "ruta_fabricacion.update");

    expect(args?.where).toEqual({ id_ruta: RUTA });
    expect(args?.data).not.toHaveProperty("estado");
  });
});

// A2 (hallazgo 1 de la auditoria de la 10.6): la edicion bloquea la ruta antes de
// leer lo que decide, y una carrera por el nombre, que el alta no puede evitar
// porque todavia no hay fila que bloquear, responde como el duplicado.
describe("las acciones de rutas deciden con la fila bloqueada", () => {
  const DUPLICATE = "Ya existe una ruta con ese nombre para este producto.";

  const stateOf = (result: unknown) => (result as { estado: FabricationRouteFormState }).estado;

  it.each([
    ["acepta", updateWith()],
    ["rechaza por sus ordenes", updateWith({ id_producto: OTRO_PRODUCTO }, currentRoute(2))],
  ])("la edicion bloquea la ruta antes de leerla (%s)", async (_name, actionCase) => {
    const { calls } = await runCase(update, actionCase);

    expectRowLockedBefore(calls, {
      table: "ruta_fabricacion",
      id: RUTA,
      reads: (call) => call.prisma.startsWith("ruta_fabricacion.find") || call.prisma === "producto.findFirst",
    });
  });

  it("una carrera por el nombre al crear responde como el duplicado", async () => {
    const { result } = await runCase(
      create,
      createWith({}, { "ruta_fabricacion.create": failWith(uniqueViolation()) }),
    );

    expect(stateOf(result)).toMatchObject({
      status: "error",
      error: DUPLICATE,
      fieldErrors: { nombre_ruta: [DUPLICATE] },
    });
  });

  it("una carrera por el nombre al editar responde como el duplicado", async () => {
    const { result } = await runCase(
      update,
      updateWith({}, { "ruta_fabricacion.update": failWith(uniqueViolation()) }),
    );

    expect(stateOf(result)).toMatchObject({
      status: "error",
      error: DUPLICATE,
      fieldErrors: { nombre_ruta: [DUPLICATE] },
    });
  });

  it("otro fallo no se presenta como duplicado", async () => {
    const { result } = await runCase(
      create,
      createWith({}, { "ruta_fabricacion.create": failWith(new Error("conexion perdida")) }),
    );

    expect(stateOf(result)).toMatchObject({
      status: "error",
      error: "No se pudo guardar la ruta. Intenta nuevamente.",
    });
    expect(stateOf(result)).not.toHaveProperty("fieldErrors.nombre_ruta");
  });
});

// A3 (hallazgo 2 de la auditoria de la 10.6): como en pedidos, editar conserva el
// producto actual aunque hoy este inactivo; uno nuevo debe estar activo.
describe("la edicion de una ruta con el producto inactivo", () => {
  type Recorded = { prisma?: string };

  it("no vuelve a comprobar el producto que ya tenia", async () => {
    const { calls, result } = await runCase(update, updateWith({}, product(false)));

    expect(result).toMatchObject({ estado: { status: "success", data: { id_ruta: RUTA } } });
    expect((calls as Recorded[]).filter((call) => call.prisma === "producto.findFirst")).toEqual([]);
  });

  it("rechaza pasar a otro producto inactivo", async () => {
    const { result } = await runCase(update, updateWith({ id_producto: OTRO_PRODUCTO }, product(false)));

    expect(result).toMatchObject({
      estado: {
        status: "error",
        error: "El producto seleccionado no existe o está inactivo.",
        fieldErrors: { id_producto: ["El producto seleccionado no existe o está inactivo."] },
      },
    });
  });
});

// A3 (hallazgo 10): un POST sin campos no responde con el mensaje de Zod en ingles.
describe("los mensajes de rutas estan en espanol", () => {
  it.each([
    ["alta", create, { id_ruta: null }],
    ["edicion", update, { id_ruta: RUTA }],
  ])("%s sin campos", async (_name, run, fields) => {
    const { result } = await runCase(run, { form: fields });

    expect(result).toMatchObject({
      estado: {
        status: "error",
        error: "Revisa los datos de la ruta.",
        fieldErrors: {
          id_producto: ["Seleccione un producto."],
          nombre_ruta: ["El nombre de la ruta debe tener al menos 3 caracteres."],
        },
      },
    });
  });
});

// A4: cada mensaje que antes se perdia en la pagina de error llega al formulario,
// junto al campo que lo causa, con lo escrito y sin redirigir.
describe("el alta y la edicion devuelven el resultado al formulario", () => {
  const stateOf = async (run: (formData: FormData) => Promise<unknown>, actionCase: Omit<ActionCase, "name">) =>
    ((await runCase(run, actionCase)).result as { estado: FabricationRouteFormState }).estado;

  it("con exito devuelve el id y no redirige", async () => {
    expect(await stateOf(create, createWith())).toMatchObject({ status: "success", data: { id_ruta: "RUT00000012" } });
    expect(await stateOf(update, updateWith())).toMatchObject({ status: "success", data: { id_ruta: RUTA } });
  });

  it.each([
    ["el producto del alta", create, createWith({}, product(false)), "id_producto", "El producto seleccionado no existe o está inactivo."],
    ["el nombre del alta", create, createWith({}, duplicate), "nombre_ruta", "Ya existe una ruta con ese nombre para este producto."],
    ["el nombre de la edicion", update, updateWith({}, duplicate), "nombre_ruta", "Ya existe una ruta con ese nombre para este producto."],
    [
      "el producto con ordenes",
      update,
      updateWith({ id_producto: OTRO_PRODUCTO }, currentRoute(2)),
      "id_producto",
      "No se puede cambiar el producto de una ruta con órdenes asociadas.",
    ],
  ])("%s deja el error junto al campo y conserva lo escrito", async (_name, run, actionCase, field, message) => {
    expect(await stateOf(run, actionCase)).toMatchObject({
      status: "error",
      error: message,
      fieldErrors: { [field]: [message] },
      values: { nombre_ruta: form.nombre_ruta },
    });
  });

  it.each([
    ["la ruta no existe", updateWith({}, noRoute), "La ruta seleccionada no existe."],
    ["sin id", updateWith({ id_ruta: "" }), "No se recibió la ruta de fabricación."],
  ])("%s responde con su mensaje", async (_name, actionCase, message) => {
    expect(await stateOf(update, actionCase)).toMatchObject({ status: "error", error: message });
  });

  it("sin permiso responde con un error dentro del formulario", async () => {
    expect(await stateOf(create, { ...createWith(), role: "SELLER" })).toMatchObject({
      status: "error",
      error: "No tienes permisos para gestionar rutas de fabricación.",
    });
  });
});
