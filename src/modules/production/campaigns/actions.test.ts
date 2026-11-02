import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  addCampaignDetailAction,
  changeProductionCampaignStatusAction,
  createProductionCampaignAction,
  updateProductionCampaignAction,
  type CampaignDetailFormState,
  type ProductionCampaignFormState,
} from "@/modules/production/campaigns/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isRowLock,
  type DataOverrides,
  type Role,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de campanas (entrega 10.7a), escrita antes de
// llevarlas al bloqueo de fila, al resultado de accion y al panel lateral. Cada
// caso ejecuta la accion real con Prisma, la sesion, la cache, la bitacora y los
// correlativos simulados, y fija en un snapshot, en orden: la autorizacion con
// sus roles, las lecturas, la transaccion con sus escrituras y su final, los
// correlativos, la bitacora, las revalidaciones y la redireccion o el error con
// su mensaje exacto.
//
// Varios casos fijan defectos (hallazgos de plan-10-7.md): cambian a proposito en
// sus commits fix. Desde A2, la campana se bloquea antes de leer lo que decide.
//
// Desde el panel lateral (A6), el alta y la edicion autorizan con
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

const CAMPANIA = "CAM00000003";
const PRODUCTO = "PRO00000004";

const initialState: ProductionCampaignFormState = { status: "idle" };
const create = (formData: FormData) => createProductionCampaignAction(initialState, formData);
const update = (formData: FormData) => updateProductionCampaignAction(initialState, formData);
const initialDetailState: CampaignDetailFormState = { status: "idle" };
const addDetail = (formData: FormData) => addCampaignDetailAction(initialDetailState, formData);

const failWith = (error: Error) => () => {
  throw error;
};

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });

const campaignForm: FormFields = {
  nombre_campania: "Campana escolar",
  fecha_inicio: "2026-08-01",
  fecha_fin: "2026-08-31",
  objetivo_general: "Reponer stock",
  estado: "planificada",
};

const createWith = (fields: FormFields = {}) => ({ form: { ...campaignForm, ...fields } });

const campaign = (estado: string): DataOverrides => ({
  "campania_produccion.findUnique": {
    id_campania: CAMPANIA,
    nombre_campania: "Campana escolar",
    estado,
  },
});

const noCampaign: DataOverrides = { "campania_produccion.findUnique": null };

const detailForm: FormFields = {
  id_campania: CAMPANIA,
  id_producto: PRODUCTO,
  cantidad_objetivo: "100",
  observaciones: "Primera semana",
};

const addWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...detailForm, ...fields },
  data: {
    ...campaign("activa"),
    "producto.findFirst": { id_producto: PRODUCTO, nombre_producto: "Lampa" },
    "campania_detalle.findFirst": null,
    ...data,
  },
});

const updateWith = (fields: FormFields = {}, data: DataOverrides = {}) => ({
  form: { ...campaignForm, id_campania: CAMPANIA, ...fields },
  data: { ...campaign("planificada"), ...data },
});

const statusWith = (estadoActual: string, estado: string | null, fields: FormFields = {}) => ({
  form: { id_campania: CAMPANIA, estado, ...fields },
  data: campaign(estadoActual),
});

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineCases("createProductionCampaignAction", create, [
  { name: "ADMIN crea la campana con su correlativo y la bitacora en la transaccion", ...createWith() },
  { name: "WORKSHOP_MASTER tambien crea campanas", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...createWith(), role: "SELLER" },
  { name: "fin y objetivo vacios se guardan como null", ...createWith({ fecha_fin: "", objetivo_general: "" }) },
  { name: "fin y objetivo ausentes cuentan como vacios", ...createWith({ fecha_fin: null, objetivo_general: null }) },
  { name: "el nombre es obligatorio", ...createWith({ nombre_campania: "" }) },
  { name: "el nombre no supera 100 caracteres", ...createWith({ nombre_campania: "x".repeat(101) }) },
  { name: "la fecha de inicio es obligatoria", ...createWith({ fecha_inicio: "" }) },
  { name: "una fecha de inicio imposible se rechaza", ...createWith({ fecha_inicio: "2026-13-01" }) },
  { name: "una fecha de fin imposible se rechaza", ...createWith({ fecha_fin: "2026-13-01" }) },
  { name: "el 30 de febrero se rechaza", ...createWith({ fecha_inicio: "2026-02-30", fecha_fin: "" }) },
  { name: "el fin no puede ser anterior al inicio", ...createWith({ fecha_fin: "2026-07-31" }) },
  { name: "el fin puede ser el mismo dia del inicio", ...createWith({ fecha_fin: "2026-08-01" }) },
  { name: "un estado desconocido se rechaza", ...createWith({ estado: "cerrada" }) },
  { name: "una campana no nace finalizada", ...createWith({ estado: "finalizada" }) },
  { name: "una campana no nace anulada", ...createWith({ estado: "anulada" }) },
  { name: "una campana puede nacer activa", ...createWith({ estado: "activa" }) },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
  {
    name: "un fallo al crear revierte con el mensaje generico",
    ...createWith(),
    data: { "campania_produccion.create": failWith(new Error("conexion perdida")) },
  },
]);

defineCases("addCampaignDetailAction", addDetail, [
  { name: "ADMIN agrega el producto con la cantidad producida en cero", ...addWith() },
  { name: "WORKSHOP_MASTER tambien agrega productos", ...addWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...addWith(), role: "SELLER" },
  { name: "una campana planificada admite productos", ...addWith({}, campaign("planificada")) },
  { name: "las observaciones vacias se guardan como null", ...addWith({ observaciones: "" }) },
  { name: "las observaciones ausentes cuentan como vacias", ...addWith({ observaciones: null }) },
  { name: "la cantidad se redondea a dos decimales", ...addWith({ cantidad_objetivo: "10.126" }) },
  { name: "0.004 se rechaza porque se guardaria como cero", ...addWith({ cantidad_objetivo: "0.004" }) },
  { name: "la cantidad cero se rechaza", ...addWith({ cantidad_objetivo: "0" }) },
  { name: "la cantidad no numerica se rechaza", ...addWith({ cantidad_objetivo: "abc" }) },
  { name: "sin producto se rechaza", ...addWith({ id_producto: "" }) },
  { name: "la campana no existe", ...addWith({}, noCampaign) },
  { name: "una campana finalizada no admite productos", ...addWith({}, campaign("finalizada")) },
  { name: "una campana anulada no admite productos", ...addWith({}, campaign("anulada")) },
  { name: "el producto no existe o esta inactivo", ...addWith({}, { "producto.findFirst": null }) },
  {
    name: "el producto ya esta en la campana",
    ...addWith({}, { "campania_detalle.findFirst": { id_campania_detalle: "CPD00000009" } }),
  },
  {
    name: "una carrera por el producto (P2002) responde como el duplicado",
    ...addWith({}, { "campania_detalle.create": failWith(uniqueViolation()) }),
  },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
]);

defineCases("updateProductionCampaignAction", update, [
  { name: "ADMIN actualiza la campana", ...updateWith() },
  { name: "WORKSHOP_MASTER tambien actualiza campanas", ...updateWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER: sin permiso responde con un error, sin tocar Prisma", ...updateWith(), role: "SELLER" },
  { name: "sin id se rechaza sin tocar Prisma", ...updateWith({ id_campania: "" }) },
  { name: "datos invalidos se rechazan sin tocar Prisma", ...updateWith({ nombre_campania: "" }) },
  { name: "el fin no puede ser anterior al inicio", ...updateWith({ fecha_fin: "2026-07-31" }) },
  { name: "la campana no existe", ...updateWith({}, noCampaign) },
  { name: "una campana anulada no se modifica", ...updateWith({}, campaign("anulada")) },
  {
    name: "un fallo al actualizar revierte con el mensaje generico",
    ...updateWith({}, { "campania_produccion.update": failWith(new Error("conexion perdida")) }),
  },
  { name: "una campana finalizada conserva sus datos editables", ...updateWith({ estado: "finalizada" }, campaign("finalizada")) },
  {
    name: "editar no reabre una campana finalizada",
    ...updateWith({ estado: "activa" }, campaign("finalizada")),
  },
  {
    name: "editar no anula: el estado enviado se ignora",
    ...updateWith({ estado: "anulada", fecha_fin: "" }, campaign("activa")),
  },
]);

defineCases("changeProductionCampaignStatusAction", changeProductionCampaignStatusAction, [
  { name: "activar una planificada no fija la fecha de fin", ...statusWith("planificada", "activa") },
  { name: "finalizar una activa fija la fecha de fin", ...statusWith("activa", "finalizada") },
  { name: "anular una activa fija la fecha de fin", ...statusWith("activa", "anulada") },
  { name: "anular una planificada", ...statusWith("planificada", "anulada") },
  { name: "una finalizada se puede anular y pierde su fecha de fin", ...statusWith("finalizada", "anulada") },
  { name: "finalizar una planificada se permite", ...statusWith("planificada", "finalizada") },
  { name: "WORKSHOP_MASTER tambien cambia el estado", ...statusWith("activa", "finalizada"), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede cambiar el estado", ...statusWith("activa", "finalizada"), role: "SELLER" },
  { name: "sin id se rechaza sin tocar Prisma", ...statusWith("activa", "finalizada", { id_campania: "" }) },
  { name: "planificada no es un estado de destino", ...statusWith("activa", "planificada") },
  { name: "un estado desconocido se rechaza", ...statusWith("activa", "cerrada") },
  { name: "sin estado se rechaza", ...statusWith("activa", null) },
  { name: "la campana no existe", form: { id_campania: CAMPANIA, estado: "activa" }, data: noCampaign },
  { name: "una anulada ya no cambia", ...statusWith("anulada", "activa") },
  { name: "anular dos veces se rechaza", ...statusWith("anulada", "anulada") },
  { name: "una finalizada no vuelve a activa", ...statusWith("finalizada", "activa") },
  { name: "finalizar dos veces se rechaza", ...statusWith("finalizada", "finalizada") },
  { name: "activar dos veces no escribe ni deja otra bitacora", ...statusWith("activa", "activa") },
]);

// Dos operaciones simultaneas sobre la misma campana se ponen en fila: la segunda
// espera y lee lo que escribio la primera (hallazgo 1 de la 10.7).
// D2 de la 10.7: el estado solo cambia desde la fila, con sus reglas y su bitacora.
// Editar lo saltaba: reabria una finalizada y anulaba sin fecha de fin.
describe("el estado no se cambia desde el formulario", () => {
  type Recorded = { prisma?: string; args?: { data?: Record<string, unknown> } };

  it.each(["activa", "anulada", "planificada"])("editar con estado %s no lo escribe", async (estado) => {
    const { calls, result } = await runCase(update, updateWith({ estado }, campaign("finalizada")));
    const written = (calls as Recorded[]).find((call) => call.prisma === "campania_produccion.update");

    expect(result).toEqual({ estado: expect.objectContaining({ status: "success" }) });
    expect(written?.args?.data).toEqual({
      nombre_campania: campaignForm.nombre_campania,
      fecha_inicio: new Date("2026-08-01T00:00:00"),
      fecha_fin: new Date("2026-08-31T00:00:00"),
      objetivo_general: campaignForm.objetivo_general,
    });
  });

  it("editar sin el campo estado funciona", async () => {
    const { result } = await runCase(update, updateWith({ estado: null }));

    expect(result).toEqual({ estado: expect.objectContaining({ status: "success" }) });
  });

  it.each(["finalizada", "anulada"])("el alta rechaza nacer %s", async (estado) => {
    const { result } = await runCase(create, createWith({ estado }));

    expect(result).toEqual({
      estado: expect.objectContaining({
        status: "error",
        fieldErrors: { estado: ["Selecciona un estado válido."] },
      }),
    });
  });
});

describe("las decisiones se toman con la campana bloqueada", () => {
  const reads = (call: { prisma: string }) =>
    call.prisma.startsWith("campania_produccion.find") ||
    call.prisma.startsWith("campania_detalle.find") ||
    call.prisma === "producto.findFirst";

  const CASES = [
    { name: "agregar producto", run: addDetail, actionCase: addWith() },
    { name: "editar", run: update, actionCase: updateWith() },
    {
      name: "cambiar el estado",
      run: changeProductionCampaignStatusAction,
      actionCase: statusWith("activa", "finalizada"),
    },
  ];

  it.each(CASES)("$name bloquea la fila antes de leer", async ({ run, actionCase }) => {
    const { calls } = await runCase(run, actionCase);

    expectRowLockedBefore(calls, { table: "campania_produccion", id: CAMPANIA, reads });
  });

  it("el correlativo del producto se reserva despues del bloqueo", async () => {
    const { calls } = await runCase(addDetail, addWith());
    const lock = calls.findIndex((call) => isRowLock(call, "campania_produccion", CAMPANIA));
    const correlative = calls.findIndex((call) => "effect" in call && call.effect === "getNextCorrelativeId");

    expect(lock).toBeGreaterThanOrEqual(0);
    expect(correlative).toBeGreaterThan(lock);
  });

  it("una carrera por el producto da el mensaje del duplicado", async () => {
    const { result } = await runCase(
      addDetail,
      addWith({}, { "campania_detalle.create": failWith(uniqueViolation()) }),
    );

    expect(result).toEqual({
      estado: expect.objectContaining({
        status: "error",
        fieldErrors: { id_producto: ["Ese producto ya está registrado en la campaña."] },
      }),
    });
  });

  it("cualquier otro fallo al agregar no se disfraza de duplicado", async () => {
    const { result } = await runCase(
      addDetail,
      addWith({}, { "campania_detalle.create": failWith(new Error("conexion perdida")) }),
    );

    expect(result).toEqual({
      estado: expect.objectContaining({
        status: "error",
        error: "No se pudo agregar el producto. Intenta nuevamente.",
      }),
    });
    expect(result).not.toEqual({ estado: expect.objectContaining({ fieldErrors: expect.anything() }) });
  });

  it("pedir el estado que ya tiene no escribe ni registra bitacora", async () => {
    const { calls, result } = await runCase(changeProductionCampaignStatusAction, statusWith("activa", "activa"));

    expect(result).toBe("error: La campania ya estaba en ese estado.");
    expect(calls.some((call) => "prisma" in call && call.prisma === "campania_produccion.update")).toBe(false);
    expect(calls.some((call) => "effect" in call && call.effect === "registerAuditLog")).toBe(false);
  });
});
