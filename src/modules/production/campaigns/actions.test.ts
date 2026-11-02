import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  addCampaignDetailAction,
  changeProductionCampaignStatusAction,
  createProductionCampaignAction,
  updateProductionCampaignAction,
} from "@/modules/production/campaigns/actions";
import {
  characterizeHandler,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
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
// Hoy las reglas se deciden fuera de la transaccion y varios casos fijan defectos
// (hallazgos de plan-10-7.md): cambian a proposito en sus commits fix.

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

defineCases("createProductionCampaignAction", createProductionCampaignAction, [
  { name: "ADMIN crea la campana con su correlativo y la bitacora en la transaccion", ...createWith() },
  { name: "WORKSHOP_MASTER tambien crea campanas", ...createWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede crear", ...createWith(), role: "SELLER" },
  { name: "fin y objetivo vacios se guardan como null", ...createWith({ fecha_fin: "", objetivo_general: "" }) },
  { name: "fin y objetivo ausentes cuentan como vacios", ...createWith({ fecha_fin: null, objetivo_general: null }) },
  { name: "el nombre es obligatorio", ...createWith({ nombre_campania: "" }) },
  { name: "el nombre no supera 100 caracteres", ...createWith({ nombre_campania: "x".repeat(101) }) },
  { name: "la fecha de inicio es obligatoria", ...createWith({ fecha_inicio: "" }) },
  { name: "una fecha de inicio imposible se rechaza", ...createWith({ fecha_inicio: "2026-13-01" }) },
  { name: "una fecha de fin imposible se rechaza", ...createWith({ fecha_fin: "2026-13-01" }) },
  { name: "el 30 de febrero pasa como 2 de marzo", ...createWith({ fecha_inicio: "2026-02-30", fecha_fin: "" }) },
  { name: "el fin no puede ser anterior al inicio", ...createWith({ fecha_fin: "2026-07-31" }) },
  { name: "el fin puede ser el mismo dia del inicio", ...createWith({ fecha_fin: "2026-08-01" }) },
  { name: "un estado desconocido se rechaza", ...createWith({ estado: "cerrada" }) },
  { name: "se puede crear una campana finalizada", ...createWith({ estado: "finalizada" }) },
  { name: "se puede crear una campana anulada", ...createWith({ estado: "anulada" }) },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
]);

defineCases("addCampaignDetailAction", addCampaignDetailAction, [
  { name: "ADMIN agrega el producto con la cantidad producida en cero", ...addWith() },
  { name: "WORKSHOP_MASTER tambien agrega productos", ...addWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede agregar", ...addWith(), role: "SELLER" },
  { name: "una campana planificada admite productos", ...addWith({}, campaign("planificada")) },
  { name: "las observaciones vacias se guardan como null", ...addWith({ observaciones: "" }) },
  { name: "las observaciones ausentes cuentan como vacias", ...addWith({ observaciones: null }) },
  { name: "la cantidad se redondea a dos decimales", ...addWith({ cantidad_objetivo: "10.126" }) },
  { name: "0.004 pasa y se guarda como cero", ...addWith({ cantidad_objetivo: "0.004" }) },
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
    name: "una carrera por el producto (P2002) llega sin tratar",
    ...addWith({}, { "campania_detalle.create": failWith(uniqueViolation()) }),
  },
  { name: "un POST sin campos se rechaza sin tocar Prisma", form: {} },
]);

defineCases("updateProductionCampaignAction", updateProductionCampaignAction, [
  { name: "ADMIN actualiza la campana", ...updateWith() },
  { name: "WORKSHOP_MASTER tambien actualiza campanas", ...updateWith(), role: "WORKSHOP_MASTER" },
  { name: "SELLER no puede actualizar", ...updateWith(), role: "SELLER" },
  { name: "sin id se rechaza sin tocar Prisma", ...updateWith({ id_campania: "" }) },
  { name: "datos invalidos se rechazan sin tocar Prisma", ...updateWith({ nombre_campania: "" }) },
  { name: "la campana no existe", ...updateWith({}, noCampaign) },
  { name: "una campana anulada no se modifica", ...updateWith({}, campaign("anulada")) },
  { name: "una campana finalizada se puede editar", ...updateWith({ estado: "finalizada" }, campaign("finalizada")) },
  {
    name: "editar reabre una campana finalizada, aunque la accion de fila lo prohibe",
    ...updateWith({ estado: "activa" }, campaign("finalizada")),
  },
  {
    name: "editar anula sin fijar la fecha de fin y la bitacora dice actualizar",
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
  { name: "activar dos veces escribe otra vez y deja otra bitacora", ...statusWith("activa", "activa") },
]);
