import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  generateWorkOrderProgressAction,
  reassignWorkOrderProgressAction,
  updateWorkOrderProgressAction,
} from "@/modules/production/work-order-progress/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isPrismaRead,
  type DataOverrides,
  type PrismaCall,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de avance de la orden de trabajo (grupo 1
// de fixes), escrita antes de corregir H8.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la
// bitacora y los correlativos simulados, y fija en un snapshot, en orden: la
// autorizacion con sus roles, las lecturas, las escrituras (dentro o fuera de
// una transaccion), el final de la transaccion, los correlativos, la
// bitacora (y si va dentro de la transaccion), las revalidaciones y el
// resultado: la redireccion o el mensaje de error exacto.
//
// Actualizar un avance escribe hoy sin transaccion: el avance, el estado de la
// orden que sincroniza syncWorkOrderStatus y la bitacora van por separado.
// Por eso el doble admite aqui escrituras fuera de una transaccion y las
// marca con `fueraDeTransaccion`. Las escrituras no se aplican: lo que se
// demuestra es la secuencia de operaciones, no el estado final.

const mocks = vi.hoisted(() => ({
  // Ultimo numero entregado por prefijo en el caso en curso.
  correlatives: new Map<string, number>(),
}));

vi.mock("server-only", () => ({}));
// Generar devuelve un RowStatusState desde C3 de la 11.6c (D80): su id de operacion fijo, para el
// snapshot.
vi.mock("@/lib/action-result", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/action-result")>()),
  newOperationId: () => "operacion-de-prueba",
}));
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

  const reserve = (prefijo: string, cantidad: number) => {
    const last = mocks.correlatives.get(prefijo) ?? 0;

    mocks.correlatives.set(prefijo, last + cantidad);

    return Array.from({ length: cantidad }, (_, index) =>
      formatCorrelativeId(prefijo, last + index + 1),
    );
  };

  return {
    ...(await importOriginal<typeof import("@/lib/correlatives-core")>()),
    getNextCorrelativeId: async (
      _tx: unknown,
      params: { codigoEntidad: string; prefijo: string },
    ) => {
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

expect.addSnapshotSerializer(decimalSnapshotSerializer);

// ---------------------------------------------------------------------------
// Ejecucion
// ---------------------------------------------------------------------------

type Action = (formData: FormData) => Promise<unknown>;
type ActionCase = { name: string; form: Record<string, string>; data?: DataOverrides };

async function runAction(action: Action, actionCase: ActionCase) {
  mocks.correlatives.clear();

  const formData = new FormData();

  for (const [key, value] of Object.entries(actionCase.form)) {
    formData.append(key, value);
  }

  const { calls, result } = await characterizeHandler(async () => {
    try {
      // Desde C3 de la 11.6c generar devuelve su estado (RowStatusState); las demas redirigen.
      return (await action(formData)) ?? "termino sin redirigir";
    } catch (error) {
      return (
        describeNavigationError(error) ??
        `error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, actionCase.data);

  return { calls, outcome: result };
}

// Las suites por nombre, para que las pruebas de los fixes repitan los mismos
// casos sin copiarlos.
const suites = new Map<string, { action: Action; cases: ActionCase[] }>();

function defineActionSuite(name: string, action: Action, cases: ActionCase[]) {
  suites.set(name, { action, cases });

  describe(name, () => {
    for (const actionCase of cases) {
      it(actionCase.name, async () => {
        const { calls, outcome } = await runAction(action, actionCase);

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

const OT = "OTR00000007";
const AVANCE = "AVN00000002";
const OPERARIO = "OPE00000001";
const OTRO_OPERARIO = "OPE00000004";

const STARTED_AT = new Date("2026-07-01T13:00:00.000Z");
const FINISHED_AT = new Date("2026-07-03T18:30:00.000Z");

type Row = Record<string, unknown>;

function stage(id: string, orden: number) {
  return {
    id_etapa_ruta: id,
    id_ruta: "RUT00000001",
    nombre_etapa: `Etapa ${orden}`,
    orden_secuencia: orden,
    estado: true,
  };
}

function workOrderWithRoute(changes: Row = {}) {
  return {
    id_orden_trabajo: OT,
    estado: "pendiente",
    ruta_fabricacion: {
      id_ruta: "RUT00000001",
      etapa_ruta: [
        stage("ETR00000001", 1),
        stage("ETR00000002", 2),
        stage("ETR00000003", 3),
      ],
    },
    avance_orden: [],
    ...changes,
  };
}

function advanceRow(changes: Row = {}, orderChanges: Row = {}) {
  return {
    id_avance: AVANCE,
    id_orden_trabajo: OT,
    id_etapa_ruta: "ETR00000002",
    id_operario: OPERARIO,
    estado_etapa: "en_proceso",
    porcentaje_avance: new Prisma.Decimal("40.00"),
    fecha_inicio_etapa: STARTED_AT,
    fecha_fin_etapa: null,
    observaciones: null,
    orden_trabajo: { id_orden_trabajo: OT, estado: "en_proceso", ...orderChanges },
    etapa_ruta: stage("ETR00000002", 2),
    operario: { id_operario: OPERARIO, nombres: "Luis", apellidos: "Quispe" },
    ...changes,
  };
}

const stages = (...states: string[]) => states.map((estado_etapa) => ({ estado_etapa }));

const updateForm = (changes: Record<string, string> = {}) => ({
  id_avance: AVANCE,
  estado_etapa: "en_proceso",
  porcentaje_avance: "45",
  observaciones: "",
  ...changes,
});

const reassignForm = (changes: Record<string, string> = {}) => ({
  id_avance: AVANCE,
  id_operario_nuevo: OTRO_OPERARIO,
  motivo: "Cambio de turno",
  ...changes,
});

const newOperator = { id_operario: OTRO_OPERARIO, nombres: "Rosa", apellidos: "Huaman" };

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

// C3 de la 11.6c (D80): generar recibe el estado anterior del boton (ConfirmActionButton).
const generateAction = (formData: FormData) => generateWorkOrderProgressAction({ status: "idle" }, formData);

defineActionSuite("generateWorkOrderProgressAction", generateAction, [
  {
    name: "sin orden en el formulario",
    form: { id_orden_trabajo: "" },
  },
  {
    name: "la orden no existe",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": null },
  },
  {
    name: "orden anulada",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderWithRoute({ estado: "anulada" }) },
  },
  {
    name: "orden finalizada",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderWithRoute({ estado: "finalizada" }) },
  },
  {
    name: "orden sin ruta de fabricacion",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderWithRoute({ ruta_fabricacion: null }) },
  },
  {
    name: "ruta sin etapas activas",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderWithRoute({
        ruta_fabricacion: { id_ruta: "RUT00000001", etapa_ruta: [] },
      }),
    },
  },
  {
    name: "la orden ya tiene avances",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderWithRoute({ avance_orden: [{ id_avance: AVANCE }] }),
    },
  },
  {
    name: "genera un avance por etapa activa y deja la orden pendiente, sin bitacora",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderWithRoute({ estado: "pausada" }) },
  },
]);

defineActionSuite("updateWorkOrderProgressAction", updateWorkOrderProgressAction, [
  {
    name: "datos invalidos: responde el primer mensaje de Zod sin consultar",
    form: updateForm({ porcentaje_avance: "120" }),
  },
  {
    name: "el avance no existe",
    form: updateForm(),
    data: { "avance_orden.findUnique": null },
  },
  {
    name: "orden anulada",
    form: updateForm(),
    data: { "avance_orden.findUnique": advanceRow({}, { estado: "anulada" }) },
  },
  {
    name: "orden finalizada",
    form: updateForm(),
    data: { "avance_orden.findUnique": advanceRow({}, { estado: "finalizada" }) },
  },
  {
    name: "en proceso con 0 %: sube a 1 %, fija el inicio y deja la orden en proceso",
    form: updateForm({ porcentaje_avance: "0", observaciones: "  Corte iniciado  " }),
    data: {
      "avance_orden.findUnique": advanceRow({ estado_etapa: "pendiente", fecha_inicio_etapa: null }),
      "avance_orden.findMany": stages("terminada", "en_proceso", "pendiente"),
    },
  },
  {
    name: "termina la ultima etapa: 100 %, conserva el inicio, fija el fin y finaliza la orden",
    form: updateForm({ estado_etapa: "terminada", porcentaje_avance: "40" }),
    data: {
      "avance_orden.findUnique": advanceRow(),
      "avance_orden.findMany": stages("terminada", "terminada", "terminada"),
    },
  },
  {
    name: "pausa con 100 %: baja a 99 %, borra la fecha de fin previa y pausa la orden",
    form: updateForm({ estado_etapa: "pausada", porcentaje_avance: "100" }),
    data: {
      "avance_orden.findUnique": advanceRow({ fecha_fin_etapa: FINISHED_AT }),
      "avance_orden.findMany": stages("terminada", "pausada", "pendiente"),
    },
  },
  {
    name: "vuelve a pendiente: 0 %, sin fechas, y la orden queda pendiente",
    form: updateForm({ estado_etapa: "pendiente", porcentaje_avance: "50" }),
    data: {
      "avance_orden.findUnique": advanceRow(),
      "avance_orden.findMany": stages("terminada", "pendiente", "pendiente"),
    },
  },
]);

defineActionSuite("reassignWorkOrderProgressAction", reassignWorkOrderProgressAction, [
  {
    name: "datos invalidos: sin motivo",
    form: reassignForm({ motivo: "  " }),
  },
  {
    name: "el avance no existe",
    form: reassignForm(),
    data: { "avance_orden.findUnique": null, "operario.findFirst": newOperator },
  },
  {
    name: "orden anulada",
    form: reassignForm(),
    data: {
      "avance_orden.findUnique": advanceRow({}, { estado: "anulada" }),
      "operario.findFirst": newOperator,
    },
  },
  {
    name: "orden finalizada",
    form: reassignForm(),
    data: {
      "avance_orden.findUnique": advanceRow({}, { estado: "finalizada" }),
      "operario.findFirst": newOperator,
    },
  },
  {
    name: "el nuevo operario no existe o esta inactivo",
    form: reassignForm(),
    data: { "avance_orden.findUnique": advanceRow(), "operario.findFirst": null },
  },
  {
    name: "el nuevo operario es el mismo",
    form: reassignForm({ id_operario_nuevo: OPERARIO }),
    data: {
      "avance_orden.findUnique": advanceRow(),
      "operario.findFirst": { id_operario: OPERARIO, nombres: "Luis", apellidos: "Quispe" },
    },
  },
  {
    name: "reasigna: registra la reasignacion, cambia el operario y deja bitacora",
    form: reassignForm({ id_avance: ` ${AVANCE} ` }),
    data: { "avance_orden.findUnique": advanceRow(), "operario.findFirst": newOperator },
  },
]);

// ---------------------------------------------------------------------------
// H8 (grupo 1 de fixes): los avances deciden con la orden bloqueada
// ---------------------------------------------------------------------------

// Generar, actualizar y reasignar leian la orden y validaban fuera de una
// transaccion: un doble envio de generar dejaba dos juegos de etapas, y una
// actualizacion simultanea con una anulacion devolvia la orden a en proceso.
// Ahora cada accion abre la transaccion y bloquea la orden antes de leer lo
// que decide. Actualizar y reasignar reciben el avance: primero leen solo su
// id_orden_trabajo, que ningun codigo cambia, y despues bloquean esa orden.
//
// La prueba no reproduce la carrera (no hay base de datos): fija el protocolo
// en los casos que llegan a la orden.
function locatesTheOrder(call: PrismaCall) {
  const select = (call.args as { select?: Record<string, unknown> } | undefined)?.select;

  return (
    call.prisma === "avance_orden.findUnique" &&
    JSON.stringify(select) === JSON.stringify({ id_orden_trabajo: true })
  );
}

function describeWorkOrderLock(suite: string, caseNames: string[]) {
  const found = suites.get(suite);

  if (!found) {
    throw new Error(`No existe la suite ${suite}.`);
  }

  describe(`H8: ${suite} decide con la orden bloqueada`, () => {
    for (const caseName of caseNames) {
      it(caseName, async () => {
        const actionCase = found.cases.find((item) => item.name === caseName);

        if (!actionCase) {
          throw new Error(`No existe el caso "${caseName}" en ${suite}.`);
        }

        const { calls } = await runAction(found.action, actionCase);

        expectRowLockedBefore(calls, {
          table: "orden_trabajo",
          id: OT,
          reads: (call) => isPrismaRead(call) && !locatesTheOrder(call),
        });
      });
    }
  });
}

const casesWithDatabase = (suite: string, exclude: string[] = []) =>
  (suites.get(suite)?.cases ?? [])
    .filter((actionCase) => actionCase.data !== undefined)
    .map((actionCase) => actionCase.name)
    .filter((name) => !exclude.includes(name));

// Si el avance no existe no hay orden que bloquear: esos casos los fija la
// caracterizacion.
describeWorkOrderLock("generateWorkOrderProgressAction", casesWithDatabase("generateWorkOrderProgressAction"));
describeWorkOrderLock(
  "updateWorkOrderProgressAction",
  casesWithDatabase("updateWorkOrderProgressAction", ["el avance no existe"]),
);
describeWorkOrderLock(
  "reassignWorkOrderProgressAction",
  casesWithDatabase("reassignWorkOrderProgressAction", ["el avance no existe"]),
);

it("H8 cubre 7, 6 y 5 casos de generar, actualizar y reasignar", () => {
  expect(casesWithDatabase("generateWorkOrderProgressAction")).toHaveLength(7);
  expect(casesWithDatabase("updateWorkOrderProgressAction", ["el avance no existe"])).toHaveLength(6);
  expect(casesWithDatabase("reassignWorkOrderProgressAction", ["el avance no existe"])).toHaveLength(5);
});

// Actualizar escribia el avance, el estado de la orden y la bitacora por
// separado: una falla a mitad dejaba el avance cambiado y la orden sin
// sincronizar. Ahora es una sola transaccion.
describe("H8: actualizar un avance escribe todo en una transaccion", () => {
  const updates = (suites.get("updateWorkOrderProgressAction")?.cases ?? []).filter(
    (actionCase) => actionCase.data?.["avance_orden.findMany"] !== undefined,
  );

  it("cubre las 4 actualizaciones que escriben", () => {
    expect(updates).toHaveLength(4);
  });

  for (const actionCase of updates) {
    it(actionCase.name, async () => {
      const { calls } = await runAction(updateWorkOrderProgressAction, actionCase);
      const audit = calls.filter((call) => "effect" in call && call.effect === "registerAuditLog");

      expect(calls.filter((call) => "fueraDeTransaccion" in call)).toEqual([]);
      expect(audit).toMatchObject([{ args: { enTransaccion: true } }]);
    });
  }
});

// ---------------------------------------------------------------------------
// C2 de la 11.6c (D79): el porcentaje en centesimos antes de la regla
// ---------------------------------------------------------------------------

// La columna es numeric(5, 2): lo que la accion manda se redondea al guardarse. La regla (en
// proceso o pausada, mas de 0 y menos de 100) se aplicaba al numero sin redondear, asi que 99.995
// «en proceso» llegaba a la base y quedaba en 100.00, y 0.004 quedaba en 0.00. La escritura y la
// bitacora deben llevar el porcentaje que la regla decide sobre el numero ya redondeado.
describe("C2 de la 11.6c: el porcentaje en centesimos antes de la regla", () => {
  const writtenPercentage = (calls: Awaited<ReturnType<typeof runAction>>["calls"]) =>
    calls
      .filter((call): call is PrismaCall => "prisma" in call && call.prisma === "avance_orden.update")
      .map((call) => (call.args as { data: Row }).data.porcentaje_avance);
  const auditDetail = (calls: Awaited<ReturnType<typeof runAction>>["calls"]) =>
    calls
      .filter((call) => "effect" in call && call.effect === "registerAuditLog")
      .map((call) => ((call as { args: { detalle: string } }).args.detalle));

  it.each([
    ["en_proceso", "99.995", 99, "Avance actualizado a en_proceso (99%)."],
    ["pausada", "99.995", 99, "Avance actualizado a pausada (99%)."],
    ["en_proceso", "0.004", 1, "Avance actualizado a en_proceso (1%)."],
    ["en_proceso", "45.678", 45.68, "Avance actualizado a en_proceso (45.68%)."],
  ])("%s con %s escribe %s", async (estado, porcentaje, esperado, detalle) => {
    const { calls } = await runAction(updateWorkOrderProgressAction, {
      name: "C2",
      form: updateForm({ estado_etapa: estado, porcentaje_avance: porcentaje }),
      data: {
        "avance_orden.findUnique": advanceRow(),
        "avance_orden.findMany": stages("terminada", estado, "pendiente"),
      },
    });

    expect(writtenPercentage(calls)).toEqual([esperado]);
    expect(auditDetail(calls)).toEqual([detalle]);
  });
});

// ---------------------------------------------------------------------------
// C3 de la 11.6c (D80): generar con resultado
// ---------------------------------------------------------------------------

// Redirigia a los avances al generar y lanzaba cualquier rechazo a la pagina de error. Ahora
// responde con un RowStatusState para ConfirmActionButton: el rechazo queda en la confirmacion y el
// exito trae la orden; la pagina se repinta con la revalidacion. Sin clave: con la orden bloqueada,
// un segundo envio ve los avances del primero y se rechaza. El id no se recorta, como antes.
describe("C3 de la 11.6c: generar con resultado", () => {
  type Calls = Awaited<ReturnType<typeof runAction>>["calls"];
  const indexOf = (calls: Calls, key: string) =>
    calls.findIndex((call) =>
      "prisma" in call ? call.prisma === key : "effect" in call && (call as { effect: string }).effect === key,
    );
  const caseOf = (name: string) => {
    const found = suites.get("generateWorkOrderProgressAction")?.cases.find((actionCase) => actionCase.name === name);

    if (!found) {
      throw new Error(`No existe el caso ${name}.`);
    }

    return found;
  };

  it("genera, revalida y responde con la orden, sin redirigir", async () => {
    const { calls, outcome } = await runAction(
      generateAction,
      caseOf("genera un avance por etapa activa y deja la orden pendiente, sin bitacora"),
    );

    expect(outcome).toMatchObject({ status: "success", data: { estado: "generado" }, values: { id: OT } });
    expect(indexOf(calls, "avance_orden.createMany")).toBeGreaterThan(-1);
    expect(indexOf(calls, "avance_orden.createMany")).toBeLessThan(indexOf(calls, "prisma.$transaction:commit"));
    expect(indexOf(calls, "revalidatePath")).toBeGreaterThan(-1);
  });

  it("el id no se recorta: viaja tal cual a la consulta y a la respuesta", async () => {
    const { calls, outcome } = await runAction(generateAction, {
      name: "C3",
      form: { id_orden_trabajo: ` ${OT} ` },
      data: { "orden_trabajo.findUnique": workOrderWithRoute() },
    });
    const found = calls.find((call) => "prisma" in call && call.prisma === "orden_trabajo.findUnique");

    expect(outcome).toMatchObject({ status: "success", values: { id: ` ${OT} ` } });
    expect(found).toMatchObject({ args: { where: { id_orden_trabajo: ` ${OT} ` } } });
  });

  it("sin orden en el formulario responde con el error, sin consultar", async () => {
    const { calls, outcome } = await runAction(generateAction, caseOf("sin orden en el formulario"));

    expect(outcome).toMatchObject({ status: "error", error: "No se recibió la orden de trabajo.", values: { id: "" } });
    expect(calls.filter((call) => "prisma" in call)).toEqual([]);
  });

  it.each([
    ["la orden no existe", "La orden de trabajo no existe."],
    ["orden anulada", "No se pueden generar avances para una orden anulada o finalizada."],
    ["orden finalizada", "No se pueden generar avances para una orden anulada o finalizada."],
    ["orden sin ruta de fabricacion", "La orden no tiene una ruta de fabricación asociada."],
    ["ruta sin etapas activas", "La ruta asociada no tiene etapas activas."],
    ["la orden ya tiene avances", "Esta orden ya tiene avances generados."],
  ])("%s: responde con el mensaje, revierte y no crea avances", async (name, message) => {
    const { calls, outcome } = await runAction(generateAction, caseOf(name));

    expect(outcome).toMatchObject({ status: "error", error: message, values: { id: OT } });
    expect(indexOf(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(indexOf(calls, "avance_orden.createMany")).toBe(-1);
    expect(indexOf(calls, "revalidatePath")).toBe(-1);
  });
});
