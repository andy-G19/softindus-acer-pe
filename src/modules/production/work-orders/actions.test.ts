import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  annulWorkOrderAction,
  closeWorkOrderMaterialsAction,
  createWorkOrderAction,
  deliverAdditionalMaterialAction,
  deliverWorkOrderMaterialsAction,
  finishWorkOrderAction,
  reopenWorkOrderMaterialsAction,
  returnWorkOrderMaterialAction,
} from "@/modules/production/work-orders/actions";
import {
  characterizeHandler,
  decimalSnapshotSerializer,
  describeNavigationError,
  expectAuthorizesBeforePrisma,
  expectRowLockedBefore,
  isPrismaCall,
  isPrismaRead,
  projectRows,
  type DataOverrides,
  type PrismaArgs,
} from "@/testing/page-characterization";

// Caracterizacion de las acciones de ordenes de trabajo (entrega 6), escrita
// antes de dividir actions.ts por caso de uso.
//
// Cada caso ejecuta la accion real con Prisma, la sesion, la cache, la
// bitacora y los correlativos simulados, y fija en un snapshot, en orden: la
// autorizacion con sus roles, las lecturas, la transaccion con sus escrituras
// y su final (commit o rollback), los correlativos, la bitacora (y si va
// dentro de la transaccion), las revalidaciones y el resultado: la
// redireccion o el mensaje de error exacto.
//
// material-delivery.ts se ejecuta real: sus descuentos de stock, kardex y
// alertas quedan fijados por las acciones que lo usan. Las escrituras no se
// aplican: lo que se demuestra es la secuencia de operaciones, no el estado
// final. Mover una validacion dentro o fuera de la transaccion, o un efecto
// antes o despues del commit, cambia el snapshot.

const mocks = vi.hoisted(() => ({
  // Ultimo numero entregado por prefijo en el caso en curso.
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
// @/lib/correlatives re-exporta esta implementacion, y material-delivery.ts
// la importa directamente: un solo doble cubre a ambos.
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

type FormFields = Record<string, string | string[]>;
type Action = (formData: FormData) => Promise<unknown>;
type ActionCase = { name: string; form: FormFields; data?: DataOverrides };

function formOf(fields: FormFields) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      formData.append(key, item);
    }
  }

  return formData;
}

async function runAction(action: Action, actionCase: ActionCase) {
  mocks.correlatives.clear();

  const { calls, result } = await characterizeHandler(async () => {
    try {
      await action(formOf(actionCase.form));

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

const OT = "OTR00000007";
const PRODUCTO = "PRO00000001";
const OTRO_PRODUCTO = "PRO00000009";
const RUTA = "RUT00000001";
const VERSION = "VRE00000001";
const DETALLE = "DPE00000001";
const PEDIDO = "PED00000001";
const CLIENTE = "CLI00000001";
const CAMPANIA = "CAM00000001";

const PLANCHA = "MAT00000001";
const SOLDADURA = "MAT00000002";
const PINTURA = "MAT00000003";
const TORNILLO = "MAT00000004";
const PERNO = "MAT00000005";

const REQ_PLANCHA = "ROM00000001";
const REQ_SOLDADURA = "ROM00000002";
const REQ_PINTURA = "ROM00000003";
const REQ_TORNILLO = "ROM00000004";
const REQ_PERNO = "ROM00000005";

const CLOSED_AT = new Date("2026-07-10T15:00:00.000Z");

type Row = Record<string, unknown>;

function whereOf(args: PrismaArgs) {
  return (args?.where ?? {}) as Row;
}

// --- Creacion --------------------------------------------------------------

const createForm: FormFields = {
  tipo_produccion: "reposicion_stock",
  id_detalle_pedido: "",
  id_campania: "",
  id_producto: PRODUCTO,
  id_ruta: RUTA,
  id_version_receta: VERSION,
  cantidad: "25",
  fecha_inicio: "2026-07-20",
  fecha_entrega_estimada: "2026-07-31",
  prioridad: "media",
  observaciones: "",
};

function recipeLine(
  id: string,
  material: string,
  cantidad: string,
  merma: string | null,
  tipo: string,
  costo: string,
) {
  return {
    id_detalle_receta: id,
    id_version_receta: VERSION,
    id_material: material,
    cantidad_requerida: D(cantidad),
    unidad_medida: "kg",
    tipo_consumo: tipo,
    merma_estimada_porcentaje: merma === null ? null : D(merma),
    observaciones: null,
    material: { id_material: material, costo_unitario_actual: D(costo) },
  };
}

function versionRow(changes: Row = {}, recipeChanges: Row = {}) {
  return {
    id_version_receta: VERSION,
    id_receta: "RTE00000001",
    numero_version: "v2",
    estado: "vigente",
    receta_tecnica: {
      id_receta: "RTE00000001",
      id_producto: PRODUCTO,
      estado: "activa",
      ...recipeChanges,
    },
    detalle_receta: [
      recipeLine("DRE00000001", PLANCHA, "2.50", "10.00", "materia_prima", "12.47"),
      recipeLine("DRE00000002", SOLDADURA, "0.333", "3.00", "consumible", "8.90"),
      recipeLine("DRE00000003", PINTURA, "0.16", null, "auxiliar", "31.20"),
    ],
    ...changes,
  };
}

function orderDetailRow(changes: Row = {}) {
  return {
    id_detalle_pedido: DETALLE,
    id_pedido: PEDIDO,
    id_producto: PRODUCTO,
    pedido: { id_pedido: PEDIDO, id_cliente: CLIENTE, estado: "aprobado" },
    ...changes,
  };
}

function createData(overrides: DataOverrides = {}): DataOverrides {
  return {
    "detalle_pedido.findUnique": orderDetailRow(),
    "producto.findFirst": { id_producto: PRODUCTO, nombre_producto: "Puerta metalica" },
    "ruta_fabricacion.findFirst": {
      id_ruta: RUTA,
      id_producto: PRODUCTO,
      nombre_ruta: "Ruta puerta",
      estado: true,
      etapa_ruta: [
        { id_etapa_ruta: "ETR00000001", orden_secuencia: 1, estado: true },
        { id_etapa_ruta: "ETR00000002", orden_secuencia: 2, estado: true },
      ],
    },
    "version_receta.findFirst": versionRow(),
    "campania_produccion.findFirst": {
      id_campania: CAMPANIA,
      nombre_campania: "Campania escolar",
      estado: "activa",
      campania_detalle: [{ id_producto: PRODUCTO }],
    },
    ...overrides,
  };
}

const orderForm: FormFields = {
  ...createForm,
  tipo_produccion: "pedido",
  id_detalle_pedido: DETALLE,
  id_producto: "",
};

const campaignForm: FormFields = {
  ...createForm,
  tipo_produccion: "campania",
  id_campania: CAMPANIA,
};

// --- Requerimiento congelado y materiales -----------------------------------

type MaterialSeed = {
  nombre: string;
  stock: string;
  minimo: string;
  estado?: boolean;
};

const MATERIALES: Record<string, MaterialSeed> = {
  [PLANCHA]: { nombre: "Plancha LAC 1/16", stock: "100.00", minimo: "30.00" },
  [SOLDADURA]: { nombre: "Soldadura 6011", stock: "10.00", minimo: "5.00" },
  [PINTURA]: { nombre: "Pintura anticorrosiva", stock: "12.00", minimo: "2.00" },
  [TORNILLO]: { nombre: "Tornillo 1/4", stock: "60.00", minimo: "20.00" },
  [PERNO]: { nombre: "Perno 3/8", stock: "100.00", minimo: "5.00" },
};

function materialRow(idMaterial: string, changes: Partial<MaterialSeed> = {}) {
  const seed = { ...MATERIALES[idMaterial], ...changes };

  return {
    id_material: idMaterial,
    nombre_material: seed.nombre,
    categoria: "Insumos",
    unidad_medida: "kg",
    stock_actual: D(seed.stock),
    stock_reservado: D("0.00"),
    stock_minimo: D(seed.minimo),
    costo_unitario_actual: D("10.00"),
    estado: seed.estado ?? true,
  };
}

type RequirementSeed = {
  requerida: string;
  entregada?: string;
  devuelta?: string;
  consumida?: string;
  material?: Partial<MaterialSeed>;
};

function requirementRow(
  idRequerimiento: string,
  idMaterial: string,
  seed: RequirementSeed,
) {
  return {
    id_requerimiento: idRequerimiento,
    id_orden_trabajo: OT,
    id_material: idMaterial,
    cantidad_por_unidad: D("1.00"),
    merma_estimada_porcentaje: D("0.00"),
    unidad_medida: "kg",
    tipo_consumo: "materia_prima",
    costo_unitario_registrado: D("10.00"),
    cantidad_requerida: D(seed.requerida),
    cantidad_entregada: D(seed.entregada ?? "0.00"),
    cantidad_devuelta: D(seed.devuelta ?? "0.00"),
    cantidad_consumida: D(seed.consumida ?? "0.00"),
    material: materialRow(idMaterial, seed.material),
  };
}

function workOrderRow(changes: Row = {}) {
  return {
    id_orden_trabajo: OT,
    id_producto: PRODUCTO,
    tipo_produccion: "reposicion_stock",
    cantidad: D("25.00"),
    estado: "en_proceso",
    fecha_cierre_materiales: null,
    cantidad_producida: null,
    requerimiento_orden_material: [],
    avance_orden: [],
    movimiento_inventario: [],
    ...changes,
  };
}

// Stock que tiene la base cuando la entrega o la devolucion escriben (grupo 2
// de fixes, H2). El doble no aplica escrituras: la escritura del material
// devuelve el stock de esta tabla menos lo que descuenta, o mas lo que
// devuelve, y respeta la guarda `gte` del descuento. Sin carrera es el mismo
// stock que leyo el caso de uso; los casos de H2 fijan otro.
type StockInDb = Record<string, Pick<MaterialSeed, "stock" | "minimo">>;

function stockInDb(changes: StockInDb = {}): DataOverrides {
  const written = (args: PrismaArgs) => {
    const where = whereOf(args);
    const idMaterial = String(where.id_material);
    const seed = { ...MATERIALES[idMaterial], ...changes[idMaterial] };
    const change = (args?.data as Row).stock_actual as { decrement?: number; increment?: number };
    const guard = (where.stock_actual as { gte?: number } | undefined)?.gte;
    const before = D(seed.stock);

    if (guard !== undefined && before.lessThan(guard)) {
      return null;
    }

    const after =
      change.decrement !== undefined ? before.minus(change.decrement) : before.plus(change.increment ?? 0);

    return { id_material: idMaterial, stock_actual: after, stock_minimo: D(seed.minimo) };
  };

  return {
    "material.updateManyAndReturn": (args: PrismaArgs) => {
      const row = written(args);

      return row ? projectRows([row], args) : [];
    },
    "material.update": (args: PrismaArgs) => {
      const row = written(args);

      return row ? projectRows([row], args)[0] : null;
    },
  };
}

// Alertas activas por material: el caso decide cuales existen.
function activeAlerts(byMaterial: Record<string, string>) {
  return (args: PrismaArgs) => {
    const idAlerta = byMaterial[String(whereOf(args).id_material)];

    return idAlerta ? { id_alerta: idAlerta } : null;
  };
}

function requirementWithOrder(
  idRequerimiento: string,
  idMaterial: string,
  seed: RequirementSeed,
  order: Row = {},
) {
  return {
    ...requirementRow(idRequerimiento, idMaterial, seed),
    orden_trabajo: {
      id_orden_trabajo: OT,
      estado: "en_proceso",
      fecha_cierre_materiales: null,
      ...order,
    },
  };
}

// ---------------------------------------------------------------------------
// Casos
// ---------------------------------------------------------------------------

defineActionSuite("createWorkOrderAction", createWorkOrderAction, [
  {
    name: "datos invalidos: responde el primer mensaje de Zod sin consultar",
    form: { ...createForm, cantidad: "0" },
  },
  {
    name: "pedido sin detalle: lo rechaza la validacion del formulario",
    form: { ...orderForm, id_detalle_pedido: "" },
  },
  {
    name: "fecha estimada anterior al inicio: lo rechaza la validacion",
    form: { ...createForm, fecha_entrega_estimada: "2026-07-01" },
  },
  {
    name: "pedido: el detalle no existe",
    form: orderForm,
    data: createData({ "detalle_pedido.findUnique": null }),
  },
  {
    name: "pedido: el detalle es de otro producto que el elegido",
    form: { ...orderForm, id_producto: OTRO_PRODUCTO },
    data: createData(),
  },
  {
    name: "producto inexistente o inactivo",
    form: createForm,
    data: createData({ "producto.findFirst": null }),
  },
  {
    name: "ruta inexistente o inactiva",
    form: createForm,
    data: createData({ "ruta_fabricacion.findFirst": null }),
  },
  {
    name: "ruta de otro producto",
    form: createForm,
    data: createData({
      "ruta_fabricacion.findFirst": {
        id_ruta: RUTA,
        id_producto: OTRO_PRODUCTO,
        etapa_ruta: [{ id_etapa_ruta: "ETR00000001" }],
      },
    }),
  },
  {
    name: "ruta sin etapas activas",
    form: createForm,
    data: createData({
      "ruta_fabricacion.findFirst": { id_ruta: RUTA, id_producto: PRODUCTO, etapa_ruta: [] },
    }),
  },
  {
    name: "version de receta inexistente",
    form: createForm,
    data: createData({ "version_receta.findFirst": null }),
  },
  {
    name: "version de receta no vigente",
    form: createForm,
    data: createData({ "version_receta.findFirst": versionRow({ estado: "historica" }) }),
  },
  {
    name: "receta tecnica inactiva",
    form: createForm,
    data: createData({
      "version_receta.findFirst": versionRow({}, { estado: "inactiva" }),
    }),
  },
  {
    name: "receta de otro producto",
    form: createForm,
    data: createData({
      "version_receta.findFirst": versionRow({}, { id_producto: OTRO_PRODUCTO }),
    }),
  },
  {
    name: "version sin materiales",
    form: createForm,
    data: createData({ "version_receta.findFirst": versionRow({ detalle_receta: [] }) }),
  },
  {
    name: "campania inexistente o no activa",
    form: campaignForm,
    data: createData({ "campania_produccion.findFirst": null }),
  },
  {
    name: "campania: el producto no pertenece a sus detalles",
    form: campaignForm,
    data: createData({
      "campania_produccion.findFirst": {
        id_campania: CAMPANIA,
        campania_detalle: [{ id_producto: OTRO_PRODUCTO }],
      },
    }),
  },
  {
    name: "reposicion de stock: crea la orden y congela el requerimiento",
    form: { ...createForm, observaciones: "Lote para stock de tienda" },
    data: createData(),
  },
  {
    name: "pedido sin producto en el formulario: usa el del detalle y pasa el pedido a produccion",
    form: { ...orderForm, fecha_entrega_estimada: "" },
    data: createData(),
  },
  {
    name: "pedido: si el detalle ya no existe dentro de la transaccion, no actualiza el pedido",
    form: orderForm,
    data: createData({
      "detalle_pedido.findUnique": (args: PrismaArgs) => {
        const select = (args?.select ?? {}) as Row;

        return select.id_pedido ? null : orderDetailRow();
      },
    }),
  },
  {
    name: "campania sin productos registrados: acepta el producto y crea la orden",
    form: { ...campaignForm, prioridad: "alta" },
    data: createData({
      "campania_produccion.findFirst": { id_campania: CAMPANIA, campania_detalle: [] },
    }),
  },
]);

defineActionSuite("deliverWorkOrderMaterialsAction", deliverWorkOrderMaterialsAction, [
  {
    name: "sin orden en el formulario",
    form: { id_orden_trabajo: "   " },
  },
  {
    name: "la orden no existe",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": null },
  },
  {
    name: "orden anulada",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderRow({ estado: "anulada" }) },
  },
  {
    name: "orden finalizada",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderRow({ estado: "finalizada" }) },
  },
  {
    name: "materiales ya cerrados",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderRow({ fecha_cierre_materiales: CLOSED_AT }),
    },
  },
  {
    name: "orden sin requerimiento congelado",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderRow() },
  },
  {
    name: "nada pendiente por entregar",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        requerimiento_orden_material: [
          requirementRow(REQ_PLANCHA, PLANCHA, { requerida: "68.75", entregada: "70.00" }),
        ],
      }),
    },
  },
  {
    name: "materiales inactivos: los nombra a todos",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        requerimiento_orden_material: [
          requirementRow(REQ_PLANCHA, PLANCHA, {
            requerida: "68.75",
            material: { estado: false },
          }),
          requirementRow(REQ_SOLDADURA, SOLDADURA, { requerida: "8.57" }),
          requirementRow(REQ_PINTURA, PINTURA, {
            requerida: "4.00",
            material: { estado: false },
          }),
        ],
      }),
    },
  },
  {
    name: "stock insuficiente: detalla cada material",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        requerimiento_orden_material: [
          requirementRow(REQ_PLANCHA, PLANCHA, {
            requerida: "68.75",
            material: { stock: "50.5" },
          }),
          requirementRow(REQ_SOLDADURA, SOLDADURA, {
            requerida: "8.57",
            entregada: "1.00",
          }),
          requirementRow(REQ_PINTURA, PINTURA, {
            requerida: "4.00",
            material: { stock: "3.50" },
          }),
        ],
      }),
    },
  },
  {
    name: "entrega lo pendiente: descuenta stock, registra kardex y sincroniza alertas",
    form: { id_orden_trabajo: ` ${OT} ` },
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        requerimiento_orden_material: [
          // Pendiente 48.75; queda 51.25 sobre el minimo 30: atiende su alerta.
          requirementRow(REQ_PLANCHA, PLANCHA, { requerida: "68.75", entregada: "20.00" }),
          // Queda 1.43 bajo el minimo 5 sin alerta: abre una.
          requirementRow(REQ_SOLDADURA, SOLDADURA, { requerida: "8.57" }),
          // Ya entregado: no se mueve.
          requirementRow(REQ_PINTURA, PINTURA, { requerida: "4.00", entregada: "4.00" }),
          // Queda 10 bajo el minimo 20 con alerta: la actualiza.
          requirementRow(REQ_TORNILLO, TORNILLO, { requerida: "50.00" }),
          // Queda 90 sobre el minimo 5 sin alerta: no toca alertas.
          requirementRow(REQ_PERNO, PERNO, { requerida: "10.00" }),
        ],
      }),
      "alerta_stock.findFirst": activeAlerts({
        [PLANCHA]: "ALE00000003",
        [TORNILLO]: "ALE00000004",
      }),
      ...stockInDb(),
    },
  },
  {
    name: "la guarda de stock falla dentro de la transaccion: se revierte y no revalida",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        requerimiento_orden_material: [
          requirementRow(REQ_PLANCHA, PLANCHA, { requerida: "68.75" }),
          requirementRow(REQ_SOLDADURA, SOLDADURA, { requerida: "8.57" }),
        ],
      }),
      "alerta_stock.findFirst": null,
      // Otra entrega se llevo la soldadura entre la lectura y la transaccion:
      // la base tiene 5.00 y se piden 8.57.
      ...stockInDb({ [SOLDADURA]: { stock: "5.00", minimo: "5.00" } }),
    },
  },
]);

const additionalForm: FormFields = {
  id_orden_trabajo: OT,
  id_requerimiento: REQ_PLANCHA,
  cantidad: "5.5",
  motivo: "Se rompio una pieza al cortar",
};

defineActionSuite("deliverAdditionalMaterialAction", deliverAdditionalMaterialAction, [
  {
    name: "motivo demasiado corto",
    form: { ...additionalForm, motivo: "rotura" },
  },
  {
    name: "el requerimiento no existe",
    form: additionalForm,
    data: { "requerimiento_orden_material.findUnique": null },
  },
  {
    name: "el requerimiento es de otra orden",
    form: { ...additionalForm, id_orden_trabajo: "OTR00000008" },
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
        requerida: "68.75",
      }),
    },
  },
  {
    name: "orden anulada",
    form: additionalForm,
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(
        REQ_PLANCHA,
        PLANCHA,
        { requerida: "68.75" },
        { estado: "anulada" },
      ),
    },
  },
  {
    name: "orden finalizada",
    form: additionalForm,
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(
        REQ_PLANCHA,
        PLANCHA,
        { requerida: "68.75" },
        { estado: "finalizada" },
      ),
    },
  },
  {
    name: "materiales ya cerrados",
    form: additionalForm,
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(
        REQ_PLANCHA,
        PLANCHA,
        { requerida: "68.75" },
        { fecha_cierre_materiales: CLOSED_AT },
      ),
    },
  },
  {
    name: "material inactivo",
    form: additionalForm,
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
        requerida: "68.75",
        material: { estado: false },
      }),
    },
  },
  {
    name: "stock insuficiente",
    form: additionalForm,
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
        requerida: "68.75",
        material: { stock: "5.25" },
      }),
    },
  },
  {
    name: "entrega el adicional con su motivo y sin tocar alertas",
    form: additionalForm,
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
        requerida: "68.75",
        entregada: "68.75",
        material: { stock: "40.00", minimo: "10.00" },
      }),
      "alerta_stock.findFirst": null,
      ...stockInDb({ [PLANCHA]: { stock: "40.00", minimo: "10.00" } }),
    },
  },
]);

const returnForm: FormFields = {
  id_orden_trabajo: OT,
  id_requerimiento: REQ_PLANCHA,
  cantidad: "3",
  motivo: "",
};

defineActionSuite("returnWorkOrderMaterialAction", returnWorkOrderMaterialAction, [
  {
    name: "cantidad no numerica",
    form: { ...returnForm, cantidad: "tres" },
  },
  {
    name: "el requerimiento no existe",
    form: returnForm,
    data: { "requerimiento_orden_material.findUnique": null },
  },
  {
    name: "el requerimiento es de otra orden",
    form: { ...returnForm, id_orden_trabajo: "OTR00000008" },
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
        requerida: "68.75",
        entregada: "10.00",
      }),
    },
  },
  {
    name: "orden anulada",
    form: returnForm,
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(
        REQ_PLANCHA,
        PLANCHA,
        { requerida: "68.75", entregada: "10.00" },
        { estado: "anulada" },
      ),
    },
  },
  {
    name: "materiales ya cerrados",
    form: returnForm,
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(
        REQ_PLANCHA,
        PLANCHA,
        { requerida: "68.75", entregada: "10.00" },
        { fecha_cierre_materiales: CLOSED_AT },
      ),
    },
  },
  {
    name: "no queda nada por devolver",
    form: returnForm,
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
        requerida: "68.75",
        entregada: "10.00",
        devuelta: "10.00",
      }),
    },
  },
  {
    name: "pide devolver mas de lo que queda",
    form: { ...returnForm, cantidad: "7" },
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
        requerida: "68.75",
        entregada: "10.00",
        devuelta: "4.00",
      }),
    },
  },
  {
    name: "devuelve sin motivo y el material sigue critico: actualiza la alerta",
    form: returnForm,
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
        requerida: "68.75",
        entregada: "10.00",
        material: { stock: "5.00", minimo: "8.00" },
      }),
      "alerta_stock.findFirst": activeAlerts({ [PLANCHA]: "ALE00000003" }),
      ...stockInDb({ [PLANCHA]: { stock: "5.00", minimo: "8.00" } }),
    },
  },
  {
    name: "orden finalizada: devuelve con motivo y atiende la alerta",
    form: { ...returnForm, cantidad: "2.25", motivo: "Sobro una plancha entera" },
    data: {
      "requerimiento_orden_material.findUnique": requirementWithOrder(
        REQ_PLANCHA,
        PLANCHA,
        { requerida: "68.75", entregada: "10.00", devuelta: "1.00", material: { stock: "20.00", minimo: "8.00" } },
        { estado: "finalizada" },
      ),
      "alerta_stock.findFirst": activeAlerts({ [PLANCHA]: "ALE00000003" }),
      ...stockInDb({ [PLANCHA]: { stock: "20.00", minimo: "8.00" } }),
    },
  },
]);

const closeForm: FormFields = {
  id_orden_trabajo: OT,
  cantidad_producida: "24",
  id_requerimiento: [REQ_PLANCHA, REQ_SOLDADURA],
  cantidad_consumida: ["60.5", "8"],
};

function closableOrder(changes: Row = {}) {
  return workOrderRow({
    requerimiento_orden_material: [
      requirementRow(REQ_PLANCHA, PLANCHA, {
        requerida: "68.75",
        entregada: "68.75",
        devuelta: "5.00",
      }),
      requirementRow(REQ_SOLDADURA, SOLDADURA, { requerida: "8.57", entregada: "8.57" }),
    ],
    ...changes,
  });
}

defineActionSuite("closeWorkOrderMaterialsAction", closeWorkOrderMaterialsAction, [
  {
    name: "sin lineas de materiales",
    form: { id_orden_trabajo: OT, cantidad_producida: "24" },
  },
  {
    name: "la orden no existe",
    form: closeForm,
    data: { "orden_trabajo.findUnique": null },
  },
  {
    name: "orden anulada",
    form: closeForm,
    data: { "orden_trabajo.findUnique": closableOrder({ estado: "anulada" }) },
  },
  {
    name: "materiales ya cerrados",
    form: closeForm,
    data: {
      "orden_trabajo.findUnique": closableOrder({ fecha_cierre_materiales: CLOSED_AT }),
    },
  },
  {
    name: "orden sin requerimiento congelado",
    form: closeForm,
    data: { "orden_trabajo.findUnique": workOrderRow() },
  },
  {
    name: "no declara todos los materiales",
    form: { ...closeForm, id_requerimiento: [REQ_PLANCHA], cantidad_consumida: ["60.5"] },
    data: { "orden_trabajo.findUnique": closableOrder() },
  },
  {
    name: "declara un material que no es de la orden",
    form: { ...closeForm, id_requerimiento: [REQ_PLANCHA, REQ_PERNO] },
    data: { "orden_trabajo.findUnique": closableOrder() },
  },
  {
    name: "consumo y devolucion superan lo entregado",
    form: { ...closeForm, cantidad_consumida: ["64", "8"] },
    data: { "orden_trabajo.findUnique": closableOrder() },
  },
  {
    name: "cierra con el consumo declarado y la merma derivada",
    form: closeForm,
    data: { "orden_trabajo.findUnique": closableOrder() },
  },
  {
    name: "un consumo que no llega vale cero",
    form: { ...closeForm, cantidad_producida: "0", cantidad_consumida: ["63.75"] },
    data: { "orden_trabajo.findUnique": closableOrder() },
  },
]);

const reopenForm: FormFields = {
  id_orden_trabajo: OT,
  motivo: "Se conto mal la plancha sobrante",
};

defineActionSuite("reopenWorkOrderMaterialsAction", reopenWorkOrderMaterialsAction, [
  {
    name: "motivo demasiado corto",
    form: { ...reopenForm, motivo: "error" },
  },
  {
    name: "la orden no existe",
    form: reopenForm,
    data: { "orden_trabajo.findUnique": null },
  },
  {
    name: "materiales no cerrados",
    form: reopenForm,
    data: { "orden_trabajo.findUnique": workOrderRow() },
  },
  {
    name: "orden anulada",
    form: reopenForm,
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        estado: "anulada",
        fecha_cierre_materiales: CLOSED_AT,
      }),
    },
  },
  {
    name: "reabre y deja en la bitacora la produccion declarada",
    form: reopenForm,
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        fecha_cierre_materiales: CLOSED_AT,
        cantidad_producida: D("24.00"),
      }),
    },
  },
  {
    name: "reabre un cierre sin produccion declarada",
    form: reopenForm,
    data: {
      "orden_trabajo.findUnique": workOrderRow({ fecha_cierre_materiales: CLOSED_AT }),
    },
  },
]);

defineActionSuite("annulWorkOrderAction", annulWorkOrderAction, [
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
    name: "orden ya anulada",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderRow({ estado: "anulada" }) },
  },
  {
    name: "orden finalizada",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderRow({ estado: "finalizada" }) },
  },
  {
    name: "orden con movimientos de inventario",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        movimiento_inventario: [{ id_movimiento: "MVI00000001" }],
      }),
    },
  },
  {
    name: "anula la orden",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderRow({ estado: "pendiente" }) },
  },
  {
    name: "el id no se recorta: viaja tal cual a la consulta y a la redireccion",
    form: { id_orden_trabajo: ` ${OT} ` },
    data: { "orden_trabajo.findUnique": workOrderRow({ estado: "pausada" }) },
  },
]);

defineActionSuite("finishWorkOrderAction", finishWorkOrderAction, [
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
    data: { "orden_trabajo.findUnique": workOrderRow({ estado: "anulada" }) },
  },
  {
    name: "orden ya finalizada: vuelve al detalle sin toast ni escrituras",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        estado: "finalizada",
        avance_orden: [{ estado_etapa: "en_proceso" }],
      }),
    },
  },
  {
    name: "orden sin avances generados",
    form: { id_orden_trabajo: OT },
    data: { "orden_trabajo.findUnique": workOrderRow() },
  },
  {
    name: "etapas sin terminar",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        avance_orden: [{ estado_etapa: "terminada" }, { estado_etapa: "en_proceso" }],
      }),
    },
  },
  {
    name: "finaliza con todas las etapas terminadas",
    form: { id_orden_trabajo: OT },
    data: {
      "orden_trabajo.findUnique": workOrderRow({
        avance_orden: [{ estado_etapa: "terminada" }, { estado_etapa: "terminada" }],
      }),
    },
  },
]);

// ---------------------------------------------------------------------------
// H1 (grupo 1 de fixes): los casos de uso deciden con la orden bloqueada
// ---------------------------------------------------------------------------

// Los casos de uso leian la orden y validaban su estado, su cierre y sus
// movimientos antes de abrir la transaccion. Dos operaciones simultaneas
// sobre la misma orden decidian con la misma foto: una entrega y una
// anulacion podian dejar una orden anulada con salidas, y un doble envio de
// una devolucion devolvia dos veces. Ahora cada caso de uso abre la
// transaccion, bloquea la orden antes de la primera lectura y decide dentro:
// el segundo espera al primero y valida con lo que este confirmo. Un bloqueo
// solo protege si las dos operaciones lo toman.
//
// La prueba no reproduce la carrera (no hay base de datos): fija el protocolo
// en cada caso que llega a la base, con el id tal como lo recibe el caso de
// uso.
function describeWorkOrderLock(
  suite: string,
  expectedCases: number,
  idOf: (actionCase: ActionCase) => string,
) {
  const found = suites.get(suite);

  if (!found) {
    throw new Error(`No existe la suite ${suite}.`);
  }

  const reachingDatabase = found.cases.filter((actionCase) => actionCase.data !== undefined);

  describe(`H1: ${suite} decide con la orden bloqueada`, () => {
    it(`cubre los ${expectedCases} casos que llegan a la base`, () => {
      expect(reachingDatabase).toHaveLength(expectedCases);
    });

    for (const actionCase of reachingDatabase) {
      it(actionCase.name, async () => {
        const { calls } = await runAction(found.action, actionCase);

        expectRowLockedBefore(calls, {
          table: "orden_trabajo",
          id: idOf(actionCase),
          reads: isPrismaRead,
        });
      });
    }
  });
}

// Anular y finalizar no recortan el id del formulario (divergencia anotada en
// la entrega 6): el bloqueo usa el mismo id que la consulta.
const formWorkOrderId = (actionCase: ActionCase) => String(actionCase.form.id_orden_trabajo);

describeWorkOrderLock("annulWorkOrderAction", 6, formWorkOrderId);
describeWorkOrderLock("finishWorkOrderAction", 6, formWorkOrderId);

// Entregar, entrega adicional y devolver reciben el id recortado (la accion y
// el esquema lo recortan). Con un requerimiento de otra orden, se bloquea la
// orden del formulario y el caso de uso rechaza despues, como antes.
const trimmedWorkOrderId = (actionCase: ActionCase) =>
  String(actionCase.form.id_orden_trabajo).trim();

describeWorkOrderLock("deliverWorkOrderMaterialsAction", 10, trimmedWorkOrderId);
describeWorkOrderLock("deliverAdditionalMaterialAction", 8, trimmedWorkOrderId);
describeWorkOrderLock("returnWorkOrderMaterialAction", 8, trimmedWorkOrderId);

// Cerrar y reabrir tambien reciben el id recortado (la accion y el esquema).
describeWorkOrderLock("closeWorkOrderMaterialsAction", 9, trimmedWorkOrderId);
describeWorkOrderLock("reopenWorkOrderMaterialsAction", 5, trimmedWorkOrderId);

// ---------------------------------------------------------------------------
// H2 (grupo 2 de fixes): el kardex anota el stock que deja la propia escritura
// ---------------------------------------------------------------------------

// La entrega y la devolucion anotaban en el kardex, y usaban para la alerta de
// stock critico, el stock que el caso de uso leyo antes de escribir. El
// bloqueo de la orden (H1) no lo protege: otra orden, una compra o una salida
// de inventario pueden mover el mismo material entre esa lectura y la
// escritura, y el kardex queda con dos movimientos que parten del mismo stock
// anterior (MVI00000037 y MVI00000038 en staging). Ahora la escritura devuelve
// el stock que dejo, y de ahi salen el kardex y la alerta.
//
// Cada caso lee un stock y la base tiene otro al escribir: el que dejo la
// operacion que se colo en medio.
describe("H2: el kardex anota el stock que deja la propia escritura", () => {
  function written(calls: Awaited<ReturnType<typeof runAction>>["calls"], key: string) {
    return calls
      .filter(isPrismaCall)
      .filter((call) => call.prisma === key)
      .map((call) => (call.args as { data: Row }).data);
  }

  function expectKardex(data: Row, expected: { anterior: string; cantidad: number; resultante: string }) {
    expect(String(data.stock_anterior)).toBe(D(expected.anterior).toString());
    expect(data.cantidad).toBe(expected.cantidad);
    expect(String(data.stock_resultante)).toBe(D(expected.resultante).toString());
  }

  it("entrega lo pendiente: otra orden se llevo 30 de plancha despues de la lectura", async () => {
    const { calls, outcome } = await runAction(deliverWorkOrderMaterialsAction, {
      name: "H2 entrega pendiente",
      form: { id_orden_trabajo: OT },
      data: {
        "orden_trabajo.findUnique": workOrderRow({
          requerimiento_orden_material: [
            // Lee 100.00; pendiente 48.75.
            requirementRow(REQ_PLANCHA, PLANCHA, { requerida: "68.75", entregada: "20.00" }),
          ],
        }),
        "alerta_stock.findFirst": activeAlerts({ [PLANCHA]: "ALE00000003" }),
        ...stockInDb({ [PLANCHA]: { stock: "70.00", minimo: "30.00" } }),
      },
    });

    expect(outcome).toBe("redirect:/dashboard/production/work-orders/OTR00000007?toast=work-order-materials-delivered");

    const [kardex] = written(calls, "movimiento_inventario.create");

    expectKardex(kardex, { anterior: "70.00", cantidad: 48.75, resultante: "21.25" });

    // 21.25 queda bajo el minimo 30: la alerta sigue activa con el stock real.
    // Con la lectura, 51.25 la habria dado por atendida.
    expect(written(calls, "alerta_stock.update")).toEqual([
      expect.objectContaining({ stock_detectado: 21.25, stock_minimo: 30 }),
    ]);
  });

  it("entrega adicional: el stock real deja el material en critico y abre la alerta", async () => {
    const { calls, outcome } = await runAction(deliverAdditionalMaterialAction, {
      name: "H2 entrega adicional",
      form: additionalForm,
      data: {
        "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
          requerida: "68.75",
          entregada: "68.75",
          // Lee 40.00, sobre el minimo 10.
          material: { stock: "40.00", minimo: "10.00" },
        }),
        "alerta_stock.findFirst": null,
        ...stockInDb({ [PLANCHA]: { stock: "12.00", minimo: "10.00" } }),
      },
    });

    expect(outcome).toBe("redirect:/dashboard/production/work-orders/OTR00000007?toast=work-order-additional-delivery");

    const [kardex] = written(calls, "movimiento_inventario.create");

    expectKardex(kardex, { anterior: "12.00", cantidad: 5.5, resultante: "6.50" });
    expect(written(calls, "alerta_stock.create")).toEqual([
      expect.objectContaining({ stock_detectado: 6.5, stock_minimo: 10, estado_alerta: "activa" }),
    ]);
  });

  it("devolucion: una compra sumo 10 despues de la lectura y el material sale de critico", async () => {
    const { calls, outcome } = await runAction(returnWorkOrderMaterialAction, {
      name: "H2 devolucion",
      form: returnForm,
      data: {
        "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
          requerida: "68.75",
          entregada: "10.00",
          // Lee 5.00, bajo el minimo 8.
          material: { stock: "5.00", minimo: "8.00" },
        }),
        "alerta_stock.findFirst": activeAlerts({ [PLANCHA]: "ALE00000003" }),
        ...stockInDb({ [PLANCHA]: { stock: "15.00", minimo: "8.00" } }),
      },
    });

    expect(outcome).toBe("redirect:/dashboard/production/work-orders/OTR00000007?toast=work-order-material-returned");

    const [kardex] = written(calls, "movimiento_inventario.create");

    expectKardex(kardex, { anterior: "15.00", cantidad: 3, resultante: "18.00" });

    // 18 supera el minimo 8: la alerta se atiende. Con la lectura, 8.00 la
    // habria dejado activa.
    expect(written(calls, "alerta_stock.update")).toEqual([
      expect.objectContaining({ estado_alerta: "atendida", stock_detectado: 18 }),
    ]);
  });
});
