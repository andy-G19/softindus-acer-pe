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
// Crear devuelve un FormActionState (C5 de la 11.6a): su id de operacion fijo, para el snapshot.
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
      // Desde C5 de la 11.6a crear devuelve su estado (FormActionState); las demas redirigen.
      return (await action(formOf(actionCase.form))) ?? "termino sin redirigir";
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

// C5 de la 11.6a (D66): crear recibe el estado anterior del formulario y una clave de operacion.
const CLAVE = "7c2e4a10-5b3d-4e8f-9a1c-2d3e4f5a6b7c";

const createAction = (formData: FormData) => createWorkOrderAction({ status: "idle" }, formData);

/** La clave ya estaba en la tabla: el INSERT no devuelve filas y se lee la guardada. */
function storedKey(changes: Row = {}): DataOverrides {
  return {
    "operacion_idempotente.createManyAndReturn": [],
    "operacion_idempotente.findUniqueOrThrow": {
      tipo_operacion: "crear_orden_trabajo",
      id_usuario: "USU00000001",
      id_registro_resultado: "OTR00000009",
      ...changes,
    },
  };
}

const createForm: FormFields = {
  clave_operacion: CLAVE,
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
    // C2 de la 11.6a (D63): el estado del pedido se lee con el pedido bloqueado, y de la version
    // solo su receta, para bloquearla antes de leer la version.
    "pedido.findUnique": { id_pedido: PEDIDO, id_cliente: CLIENTE, estado: "aprobado" },
    "version_receta.findUnique": { id_receta: "RTE00000001" },
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
// Desde C3 de la 11.6a (D64) la alerta activa no se lee antes: la escritura es un compare-and-set
// (updateMany con el estado «activa» en el where) y su conteo dice si habia una. Los materiales
// con alerta activa cuentan 1; los demas, 0, y entonces se abre otra.
function activeAlerts(byMaterial: Record<string, string>) {
  return (args: PrismaArgs) => {
    const where = whereOf(args);
    const idAlerta = byMaterial[String(where.id_material)];

    return { count: idAlerta && where.estado_alerta === "activa" ? 1 : 0 };
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

defineActionSuite("createWorkOrderAction", createAction, [
  {
    name: "sin clave de operacion",
    form: { ...createForm, clave_operacion: "" },
  },
  {
    name: "la misma clave ya registrada: responde con la orden creada sin escribir",
    form: createForm,
    data: createData(storedKey()),
  },
  {
    name: "la clave es de otra operacion",
    form: createForm,
    data: createData(storedKey({ tipo_operacion: "crear_compra" })),
  },
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
    name: "campania sin productos registrados: acepta el producto y crea la orden",
    form: { ...campaignForm, prioridad: "alta" },
    data: createData({
      "campania_produccion.findFirst": { id_campania: CAMPANIA, campania_detalle: [] },
    }),
  },
]);

// C3 de la 11.6b (D75): entregar lo pendiente recibe el estado anterior del boton (ConfirmActionButton).
const deliverPendingAction = (formData: FormData) => deliverWorkOrderMaterialsAction({ status: "idle" }, formData);

defineActionSuite("deliverWorkOrderMaterialsAction", deliverPendingAction, [
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
      "alerta_stock.updateMany": activeAlerts({
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
      "alerta_stock.updateMany": { count: 0 },
      // Otra entrega se llevo la soldadura entre la lectura y la transaccion:
      // la base tiene 5.00 y se piden 8.57.
      ...stockInDb({ [SOLDADURA]: { stock: "5.00", minimo: "5.00" } }),
    },
  },
]);

// C1 de la 11.6b (D73): la entrega adicional y la devolucion reciben el estado anterior del
// formulario y una clave de operacion.
const additionalAction = (formData: FormData) => deliverAdditionalMaterialAction({ status: "idle" }, formData);
const returnAction = (formData: FormData) => returnWorkOrderMaterialAction({ status: "idle" }, formData);

const additionalForm: FormFields = {
  clave_operacion: CLAVE,
  id_orden_trabajo: OT,
  id_requerimiento: REQ_PLANCHA,
  cantidad: "5.5",
  motivo: "Se rompio una pieza al cortar",
};

defineActionSuite("deliverAdditionalMaterialAction", additionalAction, [
  {
    name: "sin clave de operacion",
    form: { ...additionalForm, clave_operacion: "" },
  },
  {
    name: "la misma clave ya registrada: responde con la entrega hecha sin escribir",
    form: additionalForm,
    data: storedKey({ tipo_operacion: "entrega_adicional_material", id_registro_resultado: "MVI00000009" }),
  },
  {
    name: "la clave es de otra operacion",
    form: additionalForm,
    data: storedKey({ tipo_operacion: "devolver_material" }),
  },
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
      "alerta_stock.updateMany": { count: 0 },
      ...stockInDb({ [PLANCHA]: { stock: "40.00", minimo: "10.00" } }),
    },
  },
]);

const returnForm: FormFields = {
  clave_operacion: CLAVE,
  id_orden_trabajo: OT,
  id_requerimiento: REQ_PLANCHA,
  cantidad: "3",
  motivo: "",
};

defineActionSuite("returnWorkOrderMaterialAction", returnAction, [
  {
    name: "sin clave de operacion",
    form: { ...returnForm, clave_operacion: "" },
  },
  {
    name: "la misma clave ya registrada: responde con la devolucion hecha sin escribir",
    form: returnForm,
    data: storedKey({ tipo_operacion: "devolver_material", id_registro_resultado: "MVI00000009" }),
  },
  {
    name: "la clave es de otra operacion",
    form: returnForm,
    data: storedKey({ tipo_operacion: "entrega_adicional_material" }),
  },
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
      "alerta_stock.updateMany": activeAlerts({ [PLANCHA]: "ALE00000003" }),
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
      "alerta_stock.updateMany": activeAlerts({ [PLANCHA]: "ALE00000003" }),
      ...stockInDb({ [PLANCHA]: { stock: "20.00", minimo: "8.00" } }),
    },
  },
]);

// C2 de la 11.6b (D74): cerrar y reabrir reciben el estado anterior de su formulario.
const closeAction = (formData: FormData) => closeWorkOrderMaterialsAction({ status: "idle" }, formData);
const reopenAction = (formData: FormData) => reopenWorkOrderMaterialsAction({ status: "idle" }, formData);

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

defineActionSuite("closeWorkOrderMaterialsAction", closeAction, [
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

defineActionSuite("reopenWorkOrderMaterialsAction", reopenAction, [
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

  // Desde C1 de la 11.6b, una clave ya registrada responde antes del candado, a proposito: no
  // decide nada sobre la orden ni escribe. Esos casos llegan a la base pero no cuentan aqui.
  const reachingDatabase = found.cases.filter(
    (actionCase) =>
      actionCase.data !== undefined && !("operacion_idempotente.createManyAndReturn" in actionCase.data),
  );

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

  // Desde C1 de la 11.6a (D62) el kardex recibe la cantidad ya redondeada como su columna, en
  // texto: el mismo que va al descuento y a lo entregado.
  function expectKardex(data: Row, expected: { anterior: string; cantidad: string; resultante: string }) {
    expect(String(data.stock_anterior)).toBe(D(expected.anterior).toString());
    expect(data.cantidad).toBe(expected.cantidad);
    expect(String(data.stock_resultante)).toBe(D(expected.resultante).toString());
  }

  it("entrega lo pendiente: otra orden se llevo 30 de plancha despues de la lectura", async () => {
    const { calls, outcome } = await runAction(deliverPendingAction, {
      name: "H2 entrega pendiente",
      form: { id_orden_trabajo: OT },
      data: {
        "orden_trabajo.findUnique": workOrderRow({
          requerimiento_orden_material: [
            // Lee 100.00; pendiente 48.75.
            requirementRow(REQ_PLANCHA, PLANCHA, { requerida: "68.75", entregada: "20.00" }),
          ],
        }),
        "alerta_stock.updateMany": activeAlerts({ [PLANCHA]: "ALE00000003" }),
        ...stockInDb({ [PLANCHA]: { stock: "70.00", minimo: "30.00" } }),
      },
    });

    expect(outcome).toMatchObject({ status: "success", values: { id: OT } });

    const [kardex] = written(calls, "movimiento_inventario.create");

    expectKardex(kardex, { anterior: "70.00", cantidad: "48.75", resultante: "21.25" });

    // 21.25 queda bajo el minimo 30: la alerta sigue activa con el stock real.
    // Con la lectura, 51.25 la habria dado por atendida.
    expect(written(calls, "alerta_stock.updateMany")).toEqual([
      expect.objectContaining({ stock_detectado: 21.25, stock_minimo: 30 }),
    ]);
  });

  it("entrega adicional: el stock real deja el material en critico y abre la alerta", async () => {
    const { calls, outcome } = await runAction(additionalAction, {
      name: "H2 entrega adicional",
      form: additionalForm,
      data: {
        "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
          requerida: "68.75",
          entregada: "68.75",
          // Lee 40.00, sobre el minimo 10.
          material: { stock: "40.00", minimo: "10.00" },
        }),
        "alerta_stock.updateMany": { count: 0 },
        ...stockInDb({ [PLANCHA]: { stock: "12.00", minimo: "10.00" } }),
      },
    });

    // Desde C1 de la 11.6b el exito no redirige: responde con el movimiento.
    expect(outcome).toMatchObject({ status: "success", data: { id_movimiento: "MVI00000001" } });

    const [kardex] = written(calls, "movimiento_inventario.create");

    expectKardex(kardex, { anterior: "12.00", cantidad: "5.50", resultante: "6.50" });
    expect(written(calls, "alerta_stock.create")).toEqual([
      expect.objectContaining({ stock_detectado: 6.5, stock_minimo: 10, estado_alerta: "activa" }),
    ]);
  });

  it("devolucion: una compra sumo 10 despues de la lectura y el material sale de critico", async () => {
    const { calls, outcome } = await runAction(returnAction, {
      name: "H2 devolucion",
      form: returnForm,
      data: {
        "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
          requerida: "68.75",
          entregada: "10.00",
          // Lee 5.00, bajo el minimo 8.
          material: { stock: "5.00", minimo: "8.00" },
        }),
        "alerta_stock.updateMany": activeAlerts({ [PLANCHA]: "ALE00000003" }),
        ...stockInDb({ [PLANCHA]: { stock: "15.00", minimo: "8.00" } }),
      },
    });

    // Desde C1 de la 11.6b el exito no redirige: responde con el movimiento.
    expect(outcome).toMatchObject({ status: "success", data: { id_movimiento: "MVI00000001" } });

    const [kardex] = written(calls, "movimiento_inventario.create");

    expectKardex(kardex, { anterior: "15.00", cantidad: "3.00", resultante: "18.00" });

    // 18 supera el minimo 8: la alerta se atiende. Con la lectura, 8.00 la
    // habria dejado activa.
    expect(written(calls, "alerta_stock.updateMany")).toEqual([
      expect.objectContaining({ estado_alerta: "atendida", stock_detectado: 18 }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// H5 (grupo 2 de fixes): crear una orden por pedido lee el detalle una vez
// ---------------------------------------------------------------------------

// Crear una orden por pedido leia el mismo detalle de pedido tres veces: dos
// fuera de la transaccion, con la misma validacion repetida, y una dentro solo
// para obtener su pedido. La tercera no podia volver vacia: la orden ya creada
// referencia el detalle (clave foranea con onDelete Restrict) y ningun codigo
// cambia el pedido de un detalle. Ahora se lee una vez y su pedido y su
// cliente se reutilizan.
describe("H5: crear una orden por pedido lee el detalle una sola vez", () => {
  it("lee el detalle una vez y pasa a produccion el pedido de esa lectura", async () => {
    const { calls, outcome } = await runAction(createAction, {
      name: "H5",
      form: orderForm,
      data: createData(),
    });
    const prismaCalls = calls.filter(isPrismaCall);
    const argsOf = (key: string) =>
      prismaCalls.filter((call) => call.prisma === key).map((call) => call.args as Row);

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_orden_trabajo: "OTR00000001", clave_operacion: CLAVE },
    });
    expect(argsOf("detalle_pedido.findUnique")).toHaveLength(1);
    expect(argsOf("orden_trabajo.create")).toEqual([
      { data: expect.objectContaining({ id_cliente: CLIENTE, id_detalle_pedido: DETALLE }) },
    ]);
    expect(argsOf("pedido.update")).toEqual([
      { where: { id_pedido: PEDIDO }, data: { estado: "en_produccion" } },
    ]);
  });
});

// ---------------------------------------------------------------------------
// C2 de la 11.6a (D63): crear una orden decide con su origen bloqueado
// ---------------------------------------------------------------------------

// Crear leia el detalle de pedido, el producto, la ruta, la version de receta y la campania fuera
// de la transaccion y sin bloquear nada, y no miraba el estado del pedido: con el formulario
// abierto mientras se cancelaba el pedido, la orden se creaba y pasaba el pedido cancelado a
// «en_produccion» (hallazgo 2 de la 11.6). Ahora, dentro de la transaccion, bloquea el pedido (el
// mismo candado que cancelar, editar y crear una proforma), la campania, la ruta y la receta de la
// version, en ese orden, antes de las lecturas que deciden, y exige que el pedido este registrado
// o aprobado, lo mismo que ofrece el formulario.
describe("C2 de la 11.6a: crear una orden decide con su origen bloqueado", () => {
  const RECETA = "RTE00000001";
  // La version solo se lee antes del candado para saber su receta: id_receta no cambia.
  const withRecipeRef = (overrides: DataOverrides = {}) =>
    createData({ "version_receta.findUnique": { id_receta: RECETA }, ...overrides });

  const indexOf = (calls: Awaited<ReturnType<typeof runAction>>["calls"], key: string) =>
    calls.findIndex((call) => (isPrismaCall(call) ? call.prisma === key : "effect" in call && call.effect === key));

  it("una orden para un pedido cancelado se rechaza sin escribir", async () => {
    const { calls, outcome } = await runAction(createAction, {
      name: "C2",
      form: orderForm,
      data: withRecipeRef({
        "pedido.findUnique": { id_pedido: PEDIDO, id_cliente: CLIENTE, estado: "cancelado" },
        "detalle_pedido.findUnique": orderDetailRow({
          pedido: { id_pedido: PEDIDO, id_cliente: CLIENTE, estado: "cancelado" },
        }),
      }),
    });

    const message =
      "El pedido PED00000001 está cancelado: solo se crean órdenes para pedidos registrados o aprobados.";

    expect(outcome).toMatchObject({ status: "error", error: message, fieldErrors: { id_detalle_pedido: [message] } });
    expect(indexOf(calls, "orden_trabajo.create")).toBe(-1);
    expect(indexOf(calls, "pedido.update")).toBe(-1);
  });

  it("bloquea el pedido antes de leer su estado", async () => {
    const { calls } = await runAction(createAction, { name: "C2", form: orderForm, data: withRecipeRef() });

    expectRowLockedBefore(calls, {
      table: "pedido",
      id: PEDIDO,
      reads: (call) => call.prisma === "pedido.findUnique",
    });
  });

  it("bloquea la campania antes de leerla", async () => {
    const { calls } = await runAction(createAction, { name: "C2", form: campaignForm, data: withRecipeRef() });

    expectRowLockedBefore(calls, {
      table: "campania_produccion",
      id: CAMPANIA,
      reads: (call) => call.prisma === "campania_produccion.findFirst",
    });
  });

  it("bloquea la ruta antes de leerla", async () => {
    const { calls } = await runAction(createAction, { name: "C2", form: createForm, data: withRecipeRef() });

    expectRowLockedBefore(calls, {
      table: "ruta_fabricacion",
      id: RUTA,
      reads: (call) => call.prisma === "ruta_fabricacion.findFirst",
    });
  });

  it("bloquea la receta de la version antes de leer la version", async () => {
    const { calls } = await runAction(createAction, { name: "C2", form: createForm, data: withRecipeRef() });

    expectRowLockedBefore(calls, {
      table: "receta_tecnica",
      id: RECETA,
      reads: (call) => call.prisma === "version_receta.findFirst",
    });
  });

  it("los candados van en el orden pedido, campania, ruta, receta, y el producto se lee dentro", async () => {
    const { calls } = await runAction(createAction, {
      name: "C2",
      form: { ...orderForm, tipo_produccion: "pedido" },
      data: withRecipeRef(),
    });
    const locks = calls
      .filter(isPrismaCall)
      .filter((call) => call.prisma === "$queryRaw")
      .map((call) => /FROM aceros\.(\w+)/.exec((call.args as { sql: string }).sql)?.[1]);

    expect(locks).toEqual(["pedido", "ruta_fabricacion", "receta_tecnica"]);
    expect(indexOf(calls, "producto.findFirst")).toBeGreaterThan(indexOf(calls, "prisma.$transaction"));
  });
});

// ---------------------------------------------------------------------------
// C5 de la 11.6a (D66): crear con resultado e idempotencia
// ---------------------------------------------------------------------------

// Crear redirigia al detalle al guardar y lanzaba cualquier rechazo, que se veia en la pagina de
// error: el formulario se perdia. Y un doble envio creaba dos ordenes. Ahora devuelve un
// FormActionState: el rechazo queda en el formulario, en el campo que lo causa y con lo enviado, y
// el exito trae la orden creada para que el formulario vaya a su detalle. La clave se reclama
// como primera sentencia de la transaccion (antes de los candados) y se completa antes del commit;
// un rechazo despues del reclamo lanza dentro de la transaccion, que la deshace y libera la clave.
describe("C5 de la 11.6a: crear con resultado e idempotencia", () => {
  const indexOf = (calls: Awaited<ReturnType<typeof runAction>>["calls"], key: string) =>
    calls.findIndex((call) => (isPrismaCall(call) ? call.prisma === key : "effect" in call && call.effect === key));

  it("reclama la clave antes de los candados, la completa antes del commit y no redirige", async () => {
    const { calls, outcome } = await runAction(createAction, { name: "C5", form: createForm, data: createData() });
    const claim = calls.find((call) => isPrismaCall(call) && call.prisma === "operacion_idempotente.createManyAndReturn");

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_orden_trabajo: "OTR00000001", clave_operacion: CLAVE },
    });
    expect(claim && isPrismaCall(claim) ? (claim.args as { data: Row[] }).data : null).toEqual([
      expect.objectContaining({ clave: CLAVE, tipo_operacion: "crear_orden_trabajo", id_usuario: "USU00000001" }),
    ]);
    expect(indexOf(calls, "operacion_idempotente.createManyAndReturn")).toBeGreaterThan(indexOf(calls, "prisma.$transaction"));
    expect(indexOf(calls, "operacion_idempotente.createManyAndReturn")).toBeLessThan(indexOf(calls, "$queryRaw"));
    expect(indexOf(calls, "requerimiento_orden_material.createMany")).toBeLessThan(
      indexOf(calls, "operacion_idempotente.updateMany"),
    );
    expect(indexOf(calls, "operacion_idempotente.updateMany")).toBeLessThan(
      indexOf(calls, "prisma.$transaction:commit"),
    );
    expect(calls.filter((call) => "effect" in call && call.effect === "revalidatePath").length).toBeGreaterThan(0);
  });

  it("la misma clave responde con la orden ya creada, sin candados ni escrituras", async () => {
    const { calls, outcome } = await runAction(createAction, {
      name: "C5",
      form: createForm,
      data: createData(storedKey()),
    });

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_orden_trabajo: "OTR00000009", clave_operacion: CLAVE },
    });
    expect(indexOf(calls, "$queryRaw")).toBe(-1);
    expect(indexOf(calls, "orden_trabajo.create")).toBe(-1);
    expect(indexOf(calls, "operacion_idempotente.updateMany")).toBe(-1);
  });

  it("datos invalidos: el error queda en su campo, con lo enviado, sin consultar", async () => {
    const { calls, outcome } = await runAction(createAction, {
      name: "C5",
      form: { ...createForm, cantidad: "0" },
    });

    expect(outcome).toMatchObject({
      status: "error",
      fieldErrors: { cantidad: ["La cantidad debe ser mayor a 0."] },
      values: expect.objectContaining({ cantidad: "0", id_ruta: RUTA, id_version_receta: VERSION }),
    });
    expect(calls.filter(isPrismaCall)).toEqual([]);
  });

  it.each([
    ["el detalle de pedido no existe", orderForm, { "detalle_pedido.findUnique": null }, "id_detalle_pedido"],
    ["el producto inactivo", createForm, { "producto.findFirst": null }, "id_producto"],
    ["la ruta inactiva", createForm, { "ruta_fabricacion.findFirst": null }, "id_ruta"],
    ["la version inexistente", createForm, { "version_receta.findFirst": null }, "id_version_receta"],
    ["la campania no activa", campaignForm, { "campania_produccion.findFirst": null }, "id_campania"],
  ] as const)("%s revierte la transaccion y deja el error en su campo, con lo enviado", async (_name, form, data, field) => {
    const { calls, outcome } = await runAction(createAction, { name: "C5", form, data: createData({ ...data }) });

    expect(outcome).toMatchObject({ status: "error", values: expect.objectContaining({ id_ruta: RUTA }) });
    expect(Object.keys((outcome as { fieldErrors?: Row }).fieldErrors ?? {})).toEqual([field]);
    expect(indexOf(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(indexOf(calls, "operacion_idempotente.updateMany")).toBe(-1);
    expect(indexOf(calls, "orden_trabajo.create")).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// C1 de la 11.6b (D73): entrega adicional y devolucion con resultado e idempotencia
// ---------------------------------------------------------------------------

// Las dos redirigian al detalle al guardar y lanzaban cualquier rechazo a la pagina de error, donde
// se perdia lo escrito. Y no tenian clave: el candado de la orden ponia en fila dos envios
// iguales, pero el segundo volvia a validar y movia el stock otra vez (hallazgos 1 y 2 de la
// 11.6b: una entrega adicional salia dos veces y una devolucion parcial volvia dos veces). Ahora
// devuelven un FormActionState: el rechazo queda en su campo con lo enviado y el exito trae el
// movimiento del kardex. La clave se reclama como primera sentencia, antes del candado de la
// orden, y se completa con el movimiento antes del commit.
describe("C1 de la 11.6b: entrega adicional y devolucion con resultado e idempotencia", () => {
  const indexOf = (calls: Awaited<ReturnType<typeof runAction>>["calls"], key: string) =>
    calls.findIndex((call) => (isPrismaCall(call) ? call.prisma === key : "effect" in call && call.effect === key));
  const claimOf = (calls: Awaited<ReturnType<typeof runAction>>["calls"]) => {
    const claim = calls.find((call) => isPrismaCall(call) && call.prisma === "operacion_idempotente.createManyAndReturn");

    return claim && isPrismaCall(claim) ? (claim.args as { data: Row[] }).data : null;
  };

  const additionalOk: DataOverrides = {
      "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
        requerida: "68.75",
        entregada: "68.75",
        material: { stock: "40.00", minimo: "10.00" },
      }),
      "alerta_stock.updateMany": { count: 0 },
      ...stockInDb({ [PLANCHA]: { stock: "40.00", minimo: "10.00" } }),
    };

  const returnOk: DataOverrides = {
    "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
      requerida: "68.75",
      entregada: "10.00",
      material: { stock: "20.00", minimo: "8.00" },
    }),
    "alerta_stock.updateMany": { count: 0 },
    ...stockInDb({ [PLANCHA]: { stock: "20.00", minimo: "8.00" } }),
  };

  it.each([
    ["la entrega adicional", additionalAction, additionalForm, additionalOk, "entrega_adicional_material"],
    ["la devolucion", returnAction, returnForm, returnOk, "devolver_material"],
  ] as const)("%s reclama la clave antes del candado, la completa con el movimiento y no redirige", async (_name, action, form, data, tipo) => {
    const { calls, outcome } = await runAction(action, { name: "C1", form, data });

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_orden_trabajo: OT, id_movimiento: "MVI00000001", clave_operacion: CLAVE },
    });
    expect(claimOf(calls)).toEqual([
      expect.objectContaining({ clave: CLAVE, tipo_operacion: tipo, id_usuario: "USU00000001" }),
    ]);
    expect(indexOf(calls, "operacion_idempotente.createManyAndReturn")).toBeGreaterThan(indexOf(calls, "prisma.$transaction"));
    expect(indexOf(calls, "operacion_idempotente.createManyAndReturn")).toBeLessThan(indexOf(calls, "$queryRaw"));
    expect(indexOf(calls, "movimiento_inventario.create")).toBeLessThan(indexOf(calls, "operacion_idempotente.updateMany"));
    expect(indexOf(calls, "operacion_idempotente.updateMany")).toBeLessThan(indexOf(calls, "prisma.$transaction:commit"));
    expect(calls.filter((call) => "effect" in call && call.effect === "revalidatePath").length).toBeGreaterThan(0);
  });

  it.each([
    ["la entrega adicional", additionalAction, additionalForm, "entrega_adicional_material"],
    ["la devolucion", returnAction, returnForm, "devolver_material"],
  ] as const)("%s con la misma clave responde con el movimiento ya hecho, sin candado ni stock", async (_name, action, form, tipo) => {
    const { calls, outcome } = await runAction(action, {
      name: "C1",
      form,
      data: storedKey({ tipo_operacion: tipo, id_registro_resultado: "MVI00000009" }),
    });

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_orden_trabajo: OT, id_movimiento: "MVI00000009", clave_operacion: CLAVE },
    });
    expect(indexOf(calls, "$queryRaw")).toBe(-1);
    expect(indexOf(calls, "movimiento_inventario.create")).toBe(-1);
    expect(indexOf(calls, "operacion_idempotente.updateMany")).toBe(-1);
  });

  it.each([
    ["entrega: motivo corto", additionalAction, { ...additionalForm, motivo: "rotura" }, "motivo"],
    ["devolucion: cantidad no numerica", returnAction, { ...returnForm, cantidad: "tres" }, "cantidad"],
  ] as const)("%s: el error queda en su campo, con lo enviado, sin consultar", async (_name, action, form, field) => {
    const { calls, outcome } = await runAction(action, { name: "C1", form });
    const sent = form as FormFields;

    expect(outcome).toMatchObject({
      status: "error",
      values: expect.objectContaining({ id_requerimiento: REQ_PLANCHA, cantidad: sent.cantidad, motivo: sent.motivo }),
    });
    expect(Object.keys((outcome as { fieldErrors?: Row }).fieldErrors ?? {})).toContain(field);
    expect(calls.filter(isPrismaCall)).toEqual([]);
  });

  it.each([
    [
      "entrega: stock insuficiente",
      additionalAction,
      additionalForm,
      {
        "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
          requerida: "68.75",
          material: { stock: "5.25" },
        }),
      },
      ["cantidad"],
    ],
    [
      "entrega: material inactivo",
      additionalAction,
      additionalForm,
      {
        "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
          requerida: "68.75",
          material: { estado: false },
        }),
      },
      ["id_requerimiento"],
    ],
    [
      "entrega: el requerimiento no existe",
      additionalAction,
      additionalForm,
      { "requerimiento_orden_material.findUnique": null },
      ["id_requerimiento"],
    ],
    [
      "entrega: orden anulada, sin campo",
      additionalAction,
      additionalForm,
      {
        "requerimiento_orden_material.findUnique": requirementWithOrder(
          REQ_PLANCHA,
          PLANCHA,
          { requerida: "68.75" },
          { estado: "anulada" },
        ),
      },
      [],
    ],
    [
      "devolucion: pide mas de lo que queda",
      returnAction,
      { ...returnForm, cantidad: "7" },
      {
        "requerimiento_orden_material.findUnique": requirementWithOrder(REQ_PLANCHA, PLANCHA, {
          requerida: "68.75",
          entregada: "10.00",
          devuelta: "4.00",
        }),
      },
      ["cantidad"],
    ],
    [
      "devolucion: materiales ya cerrados, sin campo",
      returnAction,
      returnForm,
      {
        "requerimiento_orden_material.findUnique": requirementWithOrder(
          REQ_PLANCHA,
          PLANCHA,
          { requerida: "68.75", entregada: "10.00" },
          { fecha_cierre_materiales: CLOSED_AT },
        ),
      },
      [],
    ],
  ] as const)("%s revierte la transaccion y responde con el error, con lo enviado", async (_name, action, form, data, fields) => {
    const { calls, outcome } = await runAction(action, { name: "C1", form, data: { ...data } });

    expect(outcome).toMatchObject({ status: "error", values: expect.objectContaining({ cantidad: form.cantidad }) });
    expect(Object.keys((outcome as { fieldErrors?: Row }).fieldErrors ?? {})).toEqual(fields);
    expect(indexOf(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(indexOf(calls, "movimiento_inventario.create")).toBe(-1);
    expect(indexOf(calls, "operacion_idempotente.updateMany")).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// C2 de la 11.6b (D74): cerrar y reabrir con resultado
// ---------------------------------------------------------------------------

// Las dos redirigian al detalle al guardar y lanzaban cualquier rechazo a la pagina de error, donde
// se perdia lo declarado (el consumo de cada material y lo producido, o el motivo). Ahora devuelven
// un FormActionState: el rechazo queda en su campo con lo enviado (el consumo de una linea, en
// lineas.<posicion>.cantidad_consumida) y el exito trae la orden; el detalle se repinta con la
// revalidacion. Sin clave: la fecha de cierre ya hace que un segundo cierre, o una segunda
// reapertura, no escriba.
describe("C2 de la 11.6b: cerrar y reabrir con resultado", () => {
  const indexOf = (calls: Awaited<ReturnType<typeof runAction>>["calls"], key: string) =>
    calls.findIndex((call) => (isPrismaCall(call) ? call.prisma === key : "effect" in call && call.effect === key));
  const fieldsOf = (outcome: unknown) => Object.keys((outcome as { fieldErrors?: Row }).fieldErrors ?? {});
  const closeValues = {
    cantidad_producida: "24",
    lineas: [
      { id_requerimiento: REQ_PLANCHA, cantidad_consumida: "60.5" },
      { id_requerimiento: REQ_SOLDADURA, cantidad_consumida: "8" },
    ],
  };

  it("cerrar guarda, revalida y responde con la orden, sin redirigir", async () => {
    const { calls, outcome } = await runAction(closeAction, {
      name: "C2",
      form: closeForm,
      data: { "orden_trabajo.findUnique": closableOrder() },
    });

    expect(outcome).toMatchObject({ status: "success", data: { id_orden_trabajo: OT }, values: closeValues });
    expect(indexOf(calls, "orden_trabajo.update")).toBeLessThan(indexOf(calls, "prisma.$transaction:commit"));
    expect(calls.filter((call) => "effect" in call && call.effect === "revalidatePath").length).toBeGreaterThan(0);
  });

  it.each([
    ["lo producido negativo", { ...closeForm, cantidad_producida: "-1" }, "cantidad_producida"],
    ["el consumo de la segunda linea negativo", { ...closeForm, cantidad_consumida: ["60.5", "-2"] }, "lineas.1.cantidad_consumida"],
  ] as [string, FormFields, string][])("cerrar con %s: el error queda en su campo, con lo enviado, sin consultar", async (_name, form, field) => {
    const { calls, outcome } = await runAction(closeAction, { name: "C2", form });
    const sent = form as FormFields;

    expect(outcome).toMatchObject({
      status: "error",
      values: {
        cantidad_producida: sent.cantidad_producida,
        lineas: [
          { id_requerimiento: REQ_PLANCHA, cantidad_consumida: (sent.cantidad_consumida as string[])[0] },
          { id_requerimiento: REQ_SOLDADURA, cantidad_consumida: (sent.cantidad_consumida as string[])[1] },
        ],
      },
    });
    expect(fieldsOf(outcome)).toContain(field);
    expect(calls.filter(isPrismaCall)).toEqual([]);
  });

  it("cerrar sin lineas responde con el mensaje general, sin consultar", async () => {
    const { calls, outcome } = await runAction(closeAction, {
      name: "C2",
      form: { id_orden_trabajo: OT, cantidad_producida: "24" },
    });

    expect(outcome).toMatchObject({ status: "error", error: "La orden no tiene materiales que conciliar." });
    expect(calls.filter(isPrismaCall)).toEqual([]);
  });

  it("un consumo que con lo devuelto supera lo entregado queda en su linea y revierte", async () => {
    const { calls, outcome } = await runAction(closeAction, {
      name: "C2",
      form: { ...closeForm, cantidad_consumida: ["64", "8"] },
      data: { "orden_trabajo.findUnique": closableOrder() },
    });

    expect(outcome).toMatchObject({
      status: "error",
      values: { cantidad_producida: "24", lineas: [{ cantidad_consumida: "64" }, { cantidad_consumida: "8" }] },
    });
    expect(fieldsOf(outcome)).toEqual(["lineas.0.cantidad_consumida"]);
    expect(indexOf(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(indexOf(calls, "orden_trabajo.update")).toBe(-1);
  });

  it.each([
    ["la orden no existe", closeForm, null],
    ["la orden anulada", closeForm, closableOrder({ estado: "anulada" })],
    ["los materiales ya cerrados", closeForm, closableOrder({ fecha_cierre_materiales: CLOSED_AT })],
    ["la orden sin requerimiento congelado", closeForm, workOrderRow()],
    [
      "no declara todos los materiales",
      { ...closeForm, id_requerimiento: [REQ_PLANCHA], cantidad_consumida: ["60.5"] },
      closableOrder(),
    ],
    ["declara un material que no es de la orden", { ...closeForm, id_requerimiento: [REQ_PLANCHA, REQ_PERNO] }, closableOrder()],
  ] as [string, FormFields, Row | null][])("cerrar con %s responde con el mensaje general y revierte", async (_name, form, order) => {
    const { calls, outcome } = await runAction(closeAction, {
      name: "C2",
      form,
      data: { "orden_trabajo.findUnique": order },
    });

    expect(outcome).toMatchObject({ status: "error", values: { cantidad_producida: "24" } });
    expect(fieldsOf(outcome)).toEqual([]);
    expect(indexOf(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(indexOf(calls, "orden_trabajo.update")).toBe(-1);
  });

  it("reabrir guarda, revalida y responde con la orden, sin redirigir", async () => {
    const { calls, outcome } = await runAction(reopenAction, {
      name: "C2",
      form: reopenForm,
      data: {
        "orden_trabajo.findUnique": workOrderRow({ fecha_cierre_materiales: CLOSED_AT, cantidad_producida: D("24.00") }),
      },
    });

    expect(outcome).toMatchObject({
      status: "success",
      data: { id_orden_trabajo: OT },
      values: { motivo: reopenForm.motivo },
    });
    expect(indexOf(calls, "orden_trabajo.update")).toBeLessThan(indexOf(calls, "prisma.$transaction:commit"));
    expect(calls.filter((call) => "effect" in call && call.effect === "revalidatePath").length).toBeGreaterThan(0);
  });

  it("reabrir con un motivo corto deja el error en el motivo, con lo enviado, sin consultar", async () => {
    const { calls, outcome } = await runAction(reopenAction, { name: "C2", form: { ...reopenForm, motivo: "error" } });

    expect(outcome).toMatchObject({ status: "error", values: { motivo: "error" } });
    expect(fieldsOf(outcome)).toEqual(["motivo"]);
    expect(calls.filter(isPrismaCall)).toEqual([]);
  });

  it.each([
    ["la orden no existe", null],
    ["los materiales no cerrados", workOrderRow()],
    ["la orden anulada", workOrderRow({ estado: "anulada", fecha_cierre_materiales: CLOSED_AT })],
  ] as const)("reabrir con %s responde con el mensaje general y revierte", async (_name, order) => {
    const { calls, outcome } = await runAction(reopenAction, {
      name: "C2",
      form: reopenForm,
      data: { "orden_trabajo.findUnique": order },
    });

    expect(outcome).toMatchObject({ status: "error", values: { motivo: reopenForm.motivo } });
    expect(fieldsOf(outcome)).toEqual([]);
    expect(indexOf(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(indexOf(calls, "orden_trabajo.update")).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// C3 de la 11.6b (D75): entregar lo pendiente con resultado
// ---------------------------------------------------------------------------

// Redirigia al detalle al entregar y lanzaba cualquier rechazo a la pagina de error. Ahora
// responde con un RowStatusState para ConfirmActionButton: el rechazo queda en la confirmacion con
// su mensaje y el exito trae la orden; el detalle se repinta con la revalidacion. Sin clave: lo
// pendiente ya hace que un segundo envio no entregue nada («No queda nada pendiente»).
describe("C3 de la 11.6b: entregar lo pendiente con resultado", () => {
  const indexOf = (calls: Awaited<ReturnType<typeof runAction>>["calls"], key: string) =>
    calls.findIndex((call) => (isPrismaCall(call) ? call.prisma === key : "effect" in call && call.effect === key));
  const deliverCase = (name: string) => {
    const found = suites.get("deliverWorkOrderMaterialsAction")?.cases.find((actionCase) => actionCase.name === name);

    if (!found) {
      throw new Error(`No existe el caso ${name}.`);
    }

    return found;
  };

  it("entrega, revalida y responde con la orden, sin redirigir", async () => {
    const { calls, outcome } = await runAction(
      deliverPendingAction,
      deliverCase("entrega lo pendiente: descuenta stock, registra kardex y sincroniza alertas"),
    );

    expect(outcome).toMatchObject({ status: "success", data: { estado: "entregado" }, values: { id: OT } });
    expect(indexOf(calls, "movimiento_inventario.create")).toBeGreaterThan(-1);
    expect(indexOf(calls, "movimiento_inventario.create")).toBeLessThan(indexOf(calls, "prisma.$transaction:commit"));
    expect(calls.filter((call) => "effect" in call && call.effect === "revalidatePath").length).toBeGreaterThan(0);
  });

  it("sin orden en el formulario responde con el error, sin consultar", async () => {
    const { calls, outcome } = await runAction(deliverPendingAction, deliverCase("sin orden en el formulario"));

    expect(outcome).toMatchObject({ status: "error", error: "No se recibio la orden de trabajo.", values: { id: "" } });
    expect(calls.filter(isPrismaCall)).toEqual([]);
  });

  it.each([
    ["la orden no existe", "La orden de trabajo no existe."],
    ["orden anulada", "No se puede entregar material a una orden anulada o finalizada."],
    ["orden finalizada", "No se puede entregar material a una orden anulada o finalizada."],
    ["materiales ya cerrados", "Los materiales de esta orden ya fueron cerrados: no se puede mover mas material."],
    ["orden sin requerimiento congelado", "Esta orden no tiene requerimiento congelado"],
    ["nada pendiente por entregar", "No queda nada pendiente por entregar en esta orden."],
    ["materiales inactivos: los nombra a todos", "No se puede entregar materiales inactivos:"],
    ["stock insuficiente: detalla cada material", "Stock insuficiente para entregar la orden:"],
  ])("%s: responde con el mensaje, revierte y no mueve stock", async (name, message) => {
    const { calls, outcome } = await runAction(deliverPendingAction, deliverCase(name));

    expect(outcome).toMatchObject({ status: "error", values: { id: OT } });
    expect((outcome as { error: string }).error).toContain(message);
    expect(indexOf(calls, "prisma.$transaction:rollback")).toBeGreaterThan(-1);
    expect(indexOf(calls, "movimiento_inventario.create")).toBe(-1);
    expect(indexOf(calls, "revalidatePath")).toBe(-1);
  });
});
