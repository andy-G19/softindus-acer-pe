import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  createCostingFromWorkOrderAction,
  recalculateCostingAction,
  updateLaborCostAction,
} from "@/modules/costs/costings/actions";
import {
  annulIndirectCostAction,
  createIndirectCostAction,
} from "@/modules/costs/indirect-costs/actions";
import { createMarginAction } from "@/modules/costs/margins/actions";
import { createProfitabilityAction } from "@/modules/costs/profitability/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  type DataOverrides,
  type PrismaCall,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de costos (entrega 6), escrita antes de
// que el detalle de costeo y estas acciones compartan el calculo del costeo.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la
// bitacora y los correlativos simulados, y fija en un snapshot, en orden: los
// roles, las lecturas, la transaccion con sus escrituras y su final, los
// correlativos, la bitacora, las revalidaciones y la redireccion o el error.
// lib/costing.ts se ejecuta real: la mano de obra estimada y el recalculo de
// totales quedan fijados con sus lecturas y su escritura.
//
// Los montos se fijan tal como los calcula JavaScript, sin redondear: un
// cambio en el orden de las operaciones cambia el ultimo decimal y el
// snapshot lo detecta.
//
// Las escrituras no se aplican: una lectura posterior devuelve los datos del
// caso. Por ejemplo, al actualizar la mano de obra, el recalculo lee la mano
// de obra del caso y no la recien escrita (PostgreSQL leeria la nueva). Lo
// que se demuestra es la secuencia de operaciones y la aritmetica sobre lo
// leido, no el estado final.

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

      const next = (mocks.correlatives.get(params.prefijo) ?? 0) + 1;

      mocks.correlatives.set(params.prefijo, next);

      return formatCorrelativeId(params.prefijo, next);
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
      await action(formData);

      return "termino sin redirigir";
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

function findCase(suite: string, caseName: string) {
  const found = suites.get(suite);
  const actionCase = found?.cases.find((item) => item.name === caseName);

  if (!found || !actionCase) {
    throw new Error(`No existe el caso "${caseName}" en ${suite}.`);
  }

  return { action: found.action, actionCase };
}

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

const D = (value: string) => new Prisma.Decimal(value);

const COSTEO = "COS00000004";
const OT = "OTR00000007";

type Row = Record<string, unknown>;

function recipeLine(id: string, tipo: string, cantidad: string, merma: string | null, costo: string) {
  return {
    id_detalle_receta: id,
    id_material: `MAT0000000${id.slice(-1)}`,
    cantidad_requerida: D(cantidad),
    unidad_medida: "kg",
    tipo_consumo: tipo,
    merma_estimada_porcentaje: merma === null ? null : D(merma),
    material: {
      id_material: `MAT0000000${id.slice(-1)}`,
      nombre_material: `Material ${id.slice(-1)}`,
      costo_unitario_actual: D(costo),
    },
  };
}

function costingWorkOrder(changes: Row = {}, versionChanges: Row = {}) {
  return {
    id_orden_trabajo: OT,
    estado: "en_proceso",
    cantidad: D("25.00"),
    detalle_pedido: { id_detalle_pedido: "DPE00000001", id_pedido: "PED00000003" },
    producto: { id_producto: "PRO00000001", nombre_producto: "Puerta metalica" },
    version_receta: {
      id_version_receta: "VRE00000001",
      estado: "vigente",
      receta_tecnica: { id_receta: "RTE00000001", nombre_receta: "Puerta" },
      detalle_receta: [
        recipeLine("DRE00000001", "materia_prima", "2.50", "10.00", "12.47"),
        recipeLine("DRE00000002", "materia_prima", "0.75", null, "48.30"),
        recipeLine("DRE00000003", "consumible", "0.333", "3.00", "8.90"),
        recipeLine("DRE00000004", "auxiliar", "0.16", "5.00", "31.20"),
        // b * (1 + w / 100) y b + b * w / 100 dan dobles distintos con esta
        // linea: fija el orden de las operaciones de la merma.
        recipeLine("DRE00000005", "consumible", "0.25", "2.50", "6.40"),
      ],
      ...versionChanges,
    },
    ...changes,
  };
}

const operatorTasks = [
  { horas_dedicadas: D("8.50"), operario: { tarifa: D("12.50") } },
  { horas_dedicadas: D("3.25"), operario: { tarifa: D("15.75") } },
  // Sin horas o sin tarifa no suman: la mano de obra es un estimado.
  { horas_dedicadas: null, operario: { tarifa: D("15.00") } },
  { horas_dedicadas: D("2.00"), operario: { tarifa: null } },
];

// Lo que lee recalculateCostingTotals, mas el id que comprueban las acciones.
function costingTotals(changes: Row = {}) {
  return {
    id_costeo: COSTEO,
    costo_materiales: D("1219.35"),
    costo_consumibles: D("85.14"),
    costo_mano_obra: D("157.44"),
    cantidad_base: D("25.00"),
    ...changes,
  };
}

const indirectAmounts = [{ monto: D("50.25") }, { monto: D("0.00") }, { monto: D("12.40") }];

function indirectCost(changes: Row = {}) {
  return {
    id_costo_indirecto: "CIN00000002",
    id_costeo: COSTEO,
    concepto: "Consumo de luz del lote",
    monto: D("50.25"),
    observaciones: null,
    ...changes,
  };
}

function costingWithMargin(margin: Row | null, changes: Row = {}) {
  return {
    id_costeo: COSTEO,
    id_pedido: "PED00000003",
    costo_total: D("1524.58"),
    margen_ganancia: margin
      ? [
          {
            id_margen: "MGN00000002",
            porcentaje_margen: D("18.00"),
            precio_sugerido: D("1799.00"),
            precio_final: null,
            ...margin,
          },
        ]
      : [],
    ...changes,
  };
}

const indirectForm = {
  id_costeo: COSTEO,
  concepto: "Consumo de luz del lote",
  categoria: "luz",
  monto: "37.80",
  criterio_prorrateo: "Prorrateado por lote",
  periodo: "2026-07",
  observaciones: "",
};

const marginForm = {
  id_costeo: COSTEO,
  porcentaje_margen: "17",
  precio_final: "",
  motivo_ajuste: "",
};

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineActionSuite("createCostingFromWorkOrderAction", createCostingFromWorkOrderAction, [
  {
    name: "sin orden en el formulario",
    form: { id_orden_trabajo: "   " },
  },
  {
    name: "la orden ya tiene costeo: vuelve a ese costeo sin toast",
    form: { id_orden_trabajo: OT },
    data: { "costeo.findFirst": { id_costeo: COSTEO } },
  },
  {
    name: "la orden no existe",
    form: { id_orden_trabajo: OT },
    data: { "costeo.findFirst": null, "orden_trabajo.findUnique": null },
  },
  {
    name: "orden anulada",
    form: { id_orden_trabajo: OT },
    data: {
      "costeo.findFirst": null,
      "orden_trabajo.findUnique": costingWorkOrder({ estado: "anulada" }),
    },
  },
  {
    name: "orden sin version de receta",
    form: { id_orden_trabajo: OT },
    data: {
      "costeo.findFirst": null,
      "orden_trabajo.findUnique": costingWorkOrder({ version_receta: null }),
    },
  },
  {
    name: "version de receta anulada",
    form: { id_orden_trabajo: OT },
    data: {
      "costeo.findFirst": null,
      "orden_trabajo.findUnique": costingWorkOrder({}, { estado: "anulada" }),
    },
  },
  {
    name: "version sin materiales",
    form: { id_orden_trabajo: OT },
    data: {
      "costeo.findFirst": null,
      "orden_trabajo.findUnique": costingWorkOrder({}, { detalle_receta: [] }),
    },
  },
  {
    name: "cantidad de la orden en cero",
    form: { id_orden_trabajo: OT },
    data: {
      "costeo.findFirst": null,
      "orden_trabajo.findUnique": costingWorkOrder({ cantidad: D("0.00") }),
    },
  },
  {
    name: "genera el costeo con materiales, consumibles y mano de obra estimada",
    form: { id_orden_trabajo: ` ${OT} ` },
    data: {
      "costeo.findFirst": null,
      "orden_trabajo.findUnique": costingWorkOrder(),
      "tarea_operario.findMany": operatorTasks,
    },
  },
  {
    name: "orden sin pedido ni tareas: sin pedido y sin mano de obra",
    form: { id_orden_trabajo: OT },
    data: {
      "costeo.findFirst": null,
      "orden_trabajo.findUnique": costingWorkOrder({ detalle_pedido: null, cantidad: D("3.00") }),
      "tarea_operario.findMany": [],
    },
  },
]);

defineActionSuite("updateLaborCostAction", updateLaborCostAction, [
  {
    name: "datos invalidos: une todos los mensajes de Zod",
    form: { id_costeo: "", costo_mano_obra: "-5" },
  },
  {
    name: "el costeo no existe: se revierte",
    form: { id_costeo: COSTEO, costo_mano_obra: "180" },
    data: { "costeo.findUnique": null },
  },
  {
    name: "actualiza la mano de obra y recalcula los totales",
    form: { id_costeo: COSTEO, costo_mano_obra: "180.5" },
    data: {
      "costeo.findUnique": costingTotals(),
      "costo_indirecto.findMany": indirectAmounts,
    },
  },
]);

defineActionSuite("recalculateCostingAction", recalculateCostingAction, [
  {
    name: "sin costeo en el formulario",
    form: { id_costeo: "" },
  },
  {
    name: "el costeo no existe: se revierte",
    form: { id_costeo: COSTEO },
    data: { "costeo.findUnique": null },
  },
  {
    name: "recalcula con los costos indirectos vigentes",
    form: { id_costeo: COSTEO },
    data: {
      "costeo.findUnique": costingTotals(),
      "costo_indirecto.findMany": indirectAmounts,
    },
  },
  {
    name: "cantidad base en cero: el costo unitario queda vacio",
    form: { id_costeo: COSTEO },
    data: {
      "costeo.findUnique": costingTotals({ cantidad_base: D("0.00") }),
      "costo_indirecto.findMany": [],
    },
  },
]);

defineActionSuite("createIndirectCostAction", createIndirectCostAction, [
  {
    name: "datos invalidos: une todos los mensajes de Zod",
    form: { ...indirectForm, concepto: "ab", categoria: "agua", monto: "-1" },
  },
  {
    name: "el costeo no existe: se revierte",
    form: indirectForm,
    data: { "costeo.findUnique": null },
  },
  {
    name: "registra el costo indirecto y recalcula",
    form: indirectForm,
    data: {
      "costeo.findUnique": costingTotals(),
      "costo_indirecto.findMany": indirectAmounts,
    },
  },
]);

defineActionSuite("annulIndirectCostAction", annulIndirectCostAction, [
  {
    name: "sin costo indirecto en el formulario",
    form: { id_costo_indirecto: "" },
  },
  {
    name: "el costo indirecto no existe",
    form: { id_costo_indirecto: "CIN00000002" },
    data: { "costo_indirecto.findUnique": null },
  },
  {
    name: "costo indirecto sin costeo asociado",
    form: { id_costo_indirecto: "CIN00000002" },
    data: { "costo_indirecto.findUnique": indirectCost({ id_costeo: null }) },
  },
  {
    name: "costo indirecto ya anulado",
    form: { id_costo_indirecto: "CIN00000002" },
    data: {
      "costo_indirecto.findUnique": indirectCost({
        observaciones: "Lote 7\n[ANULADO] 2026-07-01T10:00:00.000Z - Monto original: S/ 50.25.",
      }),
    },
  },
  {
    name: "anula conservando las observaciones previas y recalcula",
    form: { id_costo_indirecto: " CIN00000002 " },
    data: {
      "costo_indirecto.findUnique": indirectCost({ observaciones: "Medidor del taller" }),
      "costeo.findUnique": costingTotals(),
      "costo_indirecto.findMany": [{ monto: D("0.00") }, { monto: D("12.40") }],
    },
  },
  {
    name: "anula un costo sin observaciones",
    form: { id_costo_indirecto: "CIN00000002" },
    data: {
      "costo_indirecto.findUnique": indirectCost({ monto: D("7.5") }),
      "costeo.findUnique": costingTotals(),
      "costo_indirecto.findMany": [{ monto: D("0.00") }],
    },
  },
]);

defineActionSuite("createMarginAction", createMarginAction, [
  {
    name: "margen fuera de rango",
    form: { ...marginForm, porcentaje_margen: "25" },
  },
  {
    name: "el costeo no existe",
    form: marginForm,
    data: { "costeo.findUnique": null },
  },
  {
    name: "costo total en cero",
    form: marginForm,
    data: { "costeo.findUnique": { id_costeo: COSTEO, costo_total: D("0.00") } },
  },
  {
    name: "precio final menor que el costo total",
    form: { ...marginForm, precio_final: "1500" },
    data: { "costeo.findUnique": { id_costeo: COSTEO, costo_total: D("1524.58") } },
  },
  {
    name: "sin precio final: usa el precio sugerido",
    form: marginForm,
    data: { "costeo.findUnique": { id_costeo: COSTEO, costo_total: D("1524.58") } },
  },
  {
    name: "costo con centimos: fija el orden de la formula del precio sugerido",
    form: marginForm,
    data: { "costeo.findUnique": { id_costeo: COSTEO, costo_total: D("1001.37") } },
  },
  {
    name: "con precio final ajustado y motivo",
    form: {
      ...marginForm,
      porcentaje_margen: "15",
      precio_final: "1800",
      motivo_ajuste: "Redondeo por negociacion con el cliente",
    },
    data: { "costeo.findUnique": { id_costeo: COSTEO, costo_total: D("1524.58") } },
  },
]);

defineActionSuite("createProfitabilityAction", createProfitabilityAction, [
  {
    name: "sin costeo en el formulario",
    form: { id_costeo: "", observaciones: "" },
  },
  {
    name: "el costeo no existe",
    form: { id_costeo: COSTEO, observaciones: "" },
    data: { "costeo.findUnique": null },
  },
  {
    name: "sin margen aplicado",
    form: { id_costeo: COSTEO, observaciones: "" },
    data: { "costeo.findUnique": costingWithMargin(null) },
  },
  {
    name: "costo total en cero",
    form: { id_costeo: COSTEO, observaciones: "" },
    data: { "costeo.findUnique": costingWithMargin({}, { costo_total: D("0.00") }) },
  },
  {
    name: "ingreso estimado en cero",
    form: { id_costeo: COSTEO, observaciones: "" },
    data: {
      "costeo.findUnique": costingWithMargin({ precio_sugerido: D("0.00"), precio_final: null }),
    },
  },
  {
    name: "precio final bajo el margen esperado: alerta de bajo margen",
    form: { id_costeo: COSTEO, observaciones: "" },
    data: { "costeo.findUnique": costingWithMargin({ precio_final: D("1700.00") }) },
  },
  {
    name: "margen real igual al esperado: no es margen bajo",
    form: { id_costeo: COSTEO, observaciones: "" },
    data: {
      "costeo.findUnique": costingWithMargin(
        { precio_final: D("1180.00") },
        { costo_total: D("1000.00") },
      ),
    },
  },
  {
    name: "costo con centimos: fija el orden de la formula del margen real",
    form: { id_costeo: COSTEO, observaciones: "" },
    data: {
      "costeo.findUnique": costingWithMargin(
        { precio_final: D("1700.00") },
        { costo_total: D("1500.14") },
      ),
    },
  },
  {
    name: "sin precio final usa el sugerido: rentable, con observaciones",
    form: { id_costeo: COSTEO, observaciones: "Rentabilidad aceptable" },
    data: {
      "costeo.findUnique": costingWithMargin({
        porcentaje_margen: D("15.00"),
        precio_sugerido: D("1799.00"),
      }),
    },
  },
]);

// ---------------------------------------------------------------------------
// H3 (grupo 1 de fixes): el recalculo bloquea el costeo antes de leer sus montos
// ---------------------------------------------------------------------------

// recalculateCostingTotals lee el costeo y sus costos indirectos, suma en
// JavaScript y escribe el total. Si otra operacion cambia el total a la vez
// (anular dos costos indirectos, o la mano de obra y un costo indirecto), la
// ultima en escribir deja un total calculado con lo que leyo antes de que la
// otra confirmara. Bloquear la fila del costeo antes de leer pone a las dos en
// fila. Crear dos costos indirectos a la vez ya quedaba en fila por el
// correlativo CIN, pero por accidente.
//
// La prueba no reproduce la carrera (no hay base de datos): fija el protocolo
// en los 6 casos que llegan al recalculo.
function readsCostingAmounts(call: PrismaCall) {
  const select = (call.args as { select?: Record<string, unknown> } | undefined)?.select;

  return (
    (call.prisma === "costeo.findUnique" && select?.costo_materiales === true) ||
    call.prisma === "costo_indirecto.findMany"
  );
}

describe("H3: el recalculo bloquea el costeo antes de leer sus montos", () => {
  const recalculatingCases = [
    ["updateLaborCostAction", "actualiza la mano de obra y recalcula los totales"],
    ["recalculateCostingAction", "recalcula con los costos indirectos vigentes"],
    ["recalculateCostingAction", "cantidad base en cero: el costo unitario queda vacio"],
    ["createIndirectCostAction", "registra el costo indirecto y recalcula"],
    ["annulIndirectCostAction", "anula conservando las observaciones previas y recalcula"],
    ["annulIndirectCostAction", "anula un costo sin observaciones"],
  ];

  for (const [suite, caseName] of recalculatingCases) {
    it(`${suite}: ${caseName}`, async () => {
      const { action, actionCase } = findCase(suite, caseName);
      const { calls } = await runAction(action, actionCase);

      expectRowLockedBefore(calls, {
        table: "costeo",
        id: COSTEO,
        reads: readsCostingAmounts,
      });
    });
  }
});
