import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createTechnicalRecipeAction,
  toggleTechnicalRecipeStatusAction,
} from "@/modules/production/recipes/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de recetas tecnicas (entrega 10.6b),
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
const PRODUCTO = "PRO00000004";

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

const toggleOf = (estado: string | null) => ({
  form: { id_receta: RECETA },
  data: {
    "receta_tecnica.findUnique": estado === null ? null : { id_receta: RECETA, estado },
  },
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createTechnicalRecipeAction", createTechnicalRecipeAction, [
  { name: "ADMIN crea la receta activa con su correlativo y la bitacora en la transaccion", ...createWith() },
  { name: "WORKSHOP_MASTER tambien crea recetas", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", ...createWith(), role: "SELLER" },
  { name: "la descripcion vacia se guarda como null", ...createWith({ descripcion: "" }) },
  { name: "la descripcion ausente cuenta como vacia", ...createWith({ descripcion: null }) },
  { name: "datos invalidos lanzan el primer mensaje sin tocar Prisma", ...createWith({ nombre_receta: "ab" }) },
  { name: "sin producto lanza su mensaje", ...createWith({ id_producto: "" }) },
  { name: "un POST sin campos lanza sin tocar Prisma", form: {} },
  { name: "el producto no existe o esta inactivo", ...createWith({}, product(false)) },
  { name: "ya existe una receta con ese nombre para el producto", ...createWith({}, duplicate) },
  {
    name: "una carrera por el nombre (P2002) responde como el duplicado",
    ...createWith({}, { "receta_tecnica.create": failWith(uniqueViolation()) }),
  },
  {
    name: "un fallo al crear revierte y deja el error",
    ...createWith({}, { "receta_tecnica.create": failWith(new Error("conexion perdida")) }),
  },
]);

defineCases("toggleTechnicalRecipeStatusAction", toggleTechnicalRecipeStatusAction, [
  { name: "una receta activa se inactiva", ...toggleOf("activa") },
  { name: "una receta inactiva se activa", ...toggleOf("inactiva") },
  { name: "WORKSHOP_MASTER tambien cambia el estado", ...toggleOf("activa"), role: "WORKSHOP_MASTER" },
  { name: "SELLER: se redirige sin tocar Prisma", ...toggleOf("activa"), role: "SELLER" },
  { name: "sin id lanza su mensaje sin tocar Prisma", form: {} },
  { name: "la receta no existe", ...toggleOf(null) },
  {
    name: "un fallo al escribir revierte y deja el error",
    form: toggleOf("activa").form,
    data: { ...toggleOf("activa").data, "receta_tecnica.update": failWith(new Error("conexion perdida")) },
  },
]);

// B2 (hallazgo 1 de la auditoria de la 10.6): el cambio de estado bloquea la
// receta antes de leerla, y una carrera por el nombre, que el alta no puede evitar
// porque todavia no hay fila que bloquear, responde como el duplicado.
describe("las acciones de recetas deciden con la fila bloqueada", () => {
  const DUPLICATE = "Ya existe una receta con ese nombre para este producto.";

  it.each([
    ["una que existe", toggleOf("activa")],
    ["una que no existe", toggleOf(null)],
  ])("el cambio de estado bloquea la receta antes de leerla (%s)", async (_name, actionCase) => {
    const { calls } = await runCase(toggleTechnicalRecipeStatusAction, actionCase);

    expectRowLockedBefore(calls, {
      table: "receta_tecnica",
      id: RECETA,
      reads: (call) => call.prisma === "receta_tecnica.findUnique",
    });
  });

  it("una carrera por el nombre responde como el duplicado", async () => {
    const { result } = await runCase(
      createTechnicalRecipeAction,
      createWith({}, { "receta_tecnica.create": failWith(uniqueViolation()) }),
    );

    expect(result).toBe(`error: ${DUPLICATE}`);
  });

  it("otro fallo no se presenta como duplicado", async () => {
    const { result } = await runCase(
      createTechnicalRecipeAction,
      createWith({}, { "receta_tecnica.create": failWith(new Error("conexion perdida")) }),
    );

    expect(result).toBe("error: conexion perdida");
  });
});
