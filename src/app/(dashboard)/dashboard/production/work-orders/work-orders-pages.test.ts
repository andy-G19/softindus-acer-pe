import { vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import {
  definePageSuite,
  generatedResult,
  generatedRow,
} from "@/testing/page-characterization";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () =>
  (await import("@/testing/page-characterization")).dbModuleMock(),
);
vi.mock("@/lib/authz", async () =>
  (await import("@/testing/page-characterization")).authzModuleMock(),
);
vi.mock("next/navigation", async (importOriginal) =>
  (await import("@/testing/page-characterization")).navigationModuleMock(
    await importOriginal(),
  ),
);

// Caracterizacion de las paginas de Ordenes de trabajo (entrega 6), escrita
// antes de mover sus consultas a modules/production/work-orders/queries.ts y
// modules/production/work-order-progress/queries.ts.

type Args = Parameters<typeof generatedRow>[2];
type Row = Record<string, unknown>;

const D = (value: string) => new Prisma.Decimal(value);

// Orden generada desde el esquema segun el include de la pagina, con los
// cambios del caso.
function workOrder(changes: (row: Row) => Row) {
  return (args: Args) => changes(generatedRow("orden_trabajo", "findUnique", args) as Row);
}

function requirements(row: Row, seeds: Array<{ entregada: string; devuelta?: string }>) {
  return (row.requerimiento_orden_material as Row[]).map((requirement, index) => ({
    ...requirement,
    cantidad_requerida: D("50.00"),
    cantidad_entregada: D(seeds[index]?.entregada ?? "0.00"),
    cantidad_devuelta: D(seeds[index]?.devuelta ?? "0.00"),
    cantidad_consumida: D("0.00"),
  }));
}

// Listado con una orden de cada origen y estado relevante.
const mixedWorkOrders = (args: Args) => {
  const [first, second] = generatedResult("orden_trabajo", "findMany", args) as Row[];

  return [
    { ...first, tipo_produccion: "pedido", estado: "en_proceso", prioridad: "alta" },
    {
      ...second,
      tipo_produccion: "campania",
      estado: "anulada",
      prioridad: "baja",
      version_receta: null,
      _count: { avance_orden: 0, movimiento_inventario: 0 },
    },
    {
      ...first,
      id_orden_trabajo: "OTR00000003",
      tipo_produccion: "reposicion_stock",
      estado: "finalizada",
      prioridad: "media",
      detalle_pedido: null,
      cliente: null,
    },
    {
      ...second,
      id_orden_trabajo: "OTR00000004",
      tipo_produccion: "pedido",
      estado: "pendiente",
      detalle_pedido: null,
      cliente: null,
      _count: { avance_orden: 0, movimiento_inventario: 0 },
    },
  ];
};

const progressOrder = (changes: Row) =>
  workOrder((row) => ({ ...row, ...changes }));

definePageSuite([
  {
    route: "/dashboard/production/work-orders",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "puerta",
          product: "PRO00000001",
          client: "CLI00000001",
          campaign: "CAM00000001",
          type: "pedido",
          status: "en_proceso",
          priority: "alta",
          from: "2026-07-01",
          to: "2026-07-31",
          page: "2",
        },
      },
      { name: "solo hasta", searchParams: { to: "2026-07-31" } },
      {
        name: "fecha invalida y parametros repetidos",
        searchParams: { from: "2026-13-45", q: [" lote ", "otro"] },
      },
      {
        name: "origenes y estados: anular y finalizar segun el estado",
        data: { "orden_trabajo.findMany": mixedWorkOrders },
      },
      {
        name: "sin resultados",
        data: { "orden_trabajo.findMany": [], "orden_trabajo.count": 0 },
      },
    ],
  },
  {
    route: "/dashboard/production/work-orders/new",
    load: () => import("./new/page"),
    cases: [
      { name: "con opciones" },
      {
        name: "sin rutas: no permite crear",
        data: { "ruta_fabricacion.findMany": [] },
      },
    ],
  },
  {
    route: "/dashboard/production/work-orders/[id]",
    load: () => import("./[id]/page"),
    cases: [
      {
        name: "materiales cerrados: ADMIN puede reabrir",
        params: { id: "OTR00000001" },
      },
      {
        name: "materiales cerrados: WORKSHOP_MASTER no puede reabrir",
        params: { id: "OTR00000001" },
        role: "WORKSHOP_MASTER",
      },
      {
        name: "con entregas y pendiente: entrega lo pendiente y concilia",
        params: { id: "OTR00000001" },
        searchParams: { returnTo: "/dashboard/production/work-orders?status=en_proceso" },
        data: {
          "orden_trabajo.findUnique": workOrder((row) => ({
            ...row,
            estado: "en_proceso",
            tipo_produccion: "campania",
            fecha_cierre_materiales: null,
            requerimiento_orden_material: requirements(row, [
              { entregada: "20.00", devuelta: "2.00" },
              { entregada: "60.00" },
            ]),
          })),
        },
      },
      {
        name: "sin entregas: entrega materiales y aun no concilia",
        params: { id: "OTR00000001" },
        data: {
          "orden_trabajo.findUnique": workOrder((row) => ({
            ...row,
            estado: "pendiente",
            fecha_cierre_materiales: null,
            requerimiento_orden_material: requirements(row, [
              { entregada: "0.00" },
              { entregada: "0.00" },
            ]),
          })),
        },
      },
      {
        name: "todo entregado: sin boton de entrega",
        params: { id: "OTR00000001" },
        data: {
          "orden_trabajo.findUnique": workOrder((row) => ({
            ...row,
            estado: "en_proceso",
            fecha_cierre_materiales: null,
            requerimiento_orden_material: requirements(row, [
              { entregada: "50.00" },
              { entregada: "50.00" },
            ]),
          })),
        },
      },
      {
        name: "orden historica sin requerimiento: desglose desde la receta",
        params: { id: "OTR00000001" },
        data: {
          "orden_trabajo.findUnique": workOrder((row) => ({
            ...row,
            tipo_produccion: "pedido",
            requerimiento_orden_material: [],
          })),
        },
      },
      {
        name: "sin receta ni requerimiento",
        params: { id: "OTR00000002" },
        data: {
          "orden_trabajo.findUnique": workOrder((row) => ({
            ...row,
            tipo_produccion: "pedido",
            detalle_pedido: null,
            version_receta: null,
            ruta_fabricacion: null,
            requerimiento_orden_material: [],
          })),
        },
      },
      {
        name: "orden anulada: sin conciliacion",
        params: { id: "OTR00000001" },
        data: {
          "orden_trabajo.findUnique": workOrder((row) => ({ ...row, estado: "anulada" })),
        },
      },
      {
        name: "inexistente",
        params: { id: "OTR99999999" },
        data: { "orden_trabajo.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/work-orders/[id]/progress",
    load: () => import("./[id]/progress/page"),
    cases: [
      { name: "con avances", params: { id: "OTR00000001" } },
      {
        name: "avances desordenados: se muestran por secuencia",
        params: { id: "OTR00000001" },
        searchParams: { returnTo: "/dashboard/production/work-orders?page=2" },
        data: {
          "orden_trabajo.findUnique": workOrder((row) => {
            const [first, second] = row.avance_orden as Row[];

            return {
              ...row,
              estado: "en_proceso",
              avance_orden: [
                {
                  ...first,
                  estado_etapa: "terminada",
                  etapa_ruta: { ...(first.etapa_ruta as Row), orden_secuencia: 2 },
                },
                {
                  ...second,
                  estado_etapa: "pausada",
                  etapa_ruta: { ...(second.etapa_ruta as Row), orden_secuencia: 1 },
                },
              ],
            };
          }),
        },
      },
      {
        name: "sin avances con ruta y etapas: puede generar",
        params: { id: "OTR00000001" },
        data: {
          "orden_trabajo.findUnique": progressOrder({ estado: "pendiente", avance_orden: [] }),
        },
      },
      {
        name: "sin avances y sin ruta",
        params: { id: "OTR00000001" },
        data: {
          "orden_trabajo.findUnique": progressOrder({
            estado: "pendiente",
            avance_orden: [],
            ruta_fabricacion: null,
          }),
        },
      },
      {
        name: "ruta sin etapas activas",
        params: { id: "OTR00000001" },
        data: {
          "orden_trabajo.findUnique": workOrder((row) => ({
            ...row,
            estado: "pendiente",
            avance_orden: [],
            ruta_fabricacion: { ...(row.ruta_fabricacion as Row), etapa_ruta: [] },
          })),
        },
      },
      {
        name: "orden finalizada: edicion deshabilitada",
        params: { id: "OTR00000001" },
        data: { "orden_trabajo.findUnique": progressOrder({ estado: "finalizada" }) },
      },
      {
        name: "inexistente",
        params: { id: "OTR99999999" },
        data: { "orden_trabajo.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/production/work-orders/[id]/progress/[advanceId]/reassign",
    load: () => import("./[id]/progress/[advanceId]/reassign/page"),
    cases: [
      {
        name: "reasignar: excluye al operario actual",
        params: { id: "OTR00000001", advanceId: "AVA00000001" },
      },
      {
        name: "avance sin operario: no excluye a nadie",
        params: { id: "OTR00000001", advanceId: "AVA00000002" },
        data: {
          "avance_orden.findFirst": (args: Args) => ({
            ...(generatedRow("avance_orden", "findFirst", args) as Row),
            id_operario: null,
            operario: null,
            reasignacion_tarea: [],
          }),
        },
      },
      {
        name: "orden finalizada: no permite reasignar",
        params: { id: "OTR00000001", advanceId: "AVA00000001" },
        data: {
          "avance_orden.findFirst": (args: Args) => {
            const row = generatedRow("avance_orden", "findFirst", args) as Row;

            return {
              ...row,
              orden_trabajo: { ...(row.orden_trabajo as Row), estado: "finalizada" },
            };
          },
        },
      },
      {
        name: "sin operarios disponibles",
        params: { id: "OTR00000001", advanceId: "AVA00000001" },
        data: { "operario.findMany": [] },
      },
      {
        name: "avance inexistente o de otra orden",
        params: { id: "OTR00000001", advanceId: "AVA99999999" },
        data: { "avance_orden.findFirst": null },
      },
    ],
  },
]);
