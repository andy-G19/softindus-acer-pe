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

// Caracterizacion de las paginas de Costos (entrega 6), escrita antes de
// mover sus consultas a queries.ts y de separar el detalle de costeo en
// datos, calculo y secciones por caso de uso. El detalle tiene un caso por
// estado de cada seccion: indirectos, margenes, rentabilidad y desglose.

type Args = Parameters<typeof generatedRow>[2];
type Row = Record<string, unknown>;

const D = (value: string) => new Prisma.Decimal(value);

// Costeo generado segun el include de la pagina, con los cambios del caso.
function costing(changes: (row: Row) => Row) {
  return (args: Args) => changes(generatedRow("costeo", "findUnique", args) as Row);
}

function firstOf(row: Row, key: string) {
  return (row[key] as Row[])[0] as Row;
}

// Listados: una fila de cada origen (orden por pedido, por campania, de
// stock, pedido sin orden y manual).
function costingsByOrigin(args: Args) {
  const [withOrder, withoutOrder] = generatedResult("costeo", "findMany", args) as Row[];
  const order = withOrder.orden_trabajo as Row;

  return [
    { ...withOrder, orden_trabajo: { ...order, tipo_produccion: "pedido" } },
    {
      ...withOrder,
      id_costeo: "COS00000003",
      orden_trabajo: { ...order, tipo_produccion: "campania", detalle_pedido: null },
      margen_ganancia: [],
      rentabilidad: [],
    },
    {
      ...withOrder,
      id_costeo: "COS00000004",
      orden_trabajo: { ...order, tipo_produccion: "stock", detalle_pedido: null, cliente: null },
    },
    { ...withOrder, id_costeo: "COS00000005", orden_trabajo: null },
    { ...withoutOrder, id_costeo: "COS00000006", orden_trabajo: null, pedido: null },
  ];
}

function costableOrdersByOrigin(args: Args) {
  const [first, second] = generatedResult("orden_trabajo", "findMany", args) as Row[];

  return [
    { ...first, tipo_produccion: "pedido" },
    { ...first, id_orden_trabajo: "OTR00000003", tipo_produccion: "campania" },
    {
      ...first,
      id_orden_trabajo: "OTR00000004",
      tipo_produccion: "pedido",
      detalle_pedido: null,
      cliente: null,
    },
    // Version sin materiales: no se puede generar el costeo.
    {
      ...second,
      tipo_produccion: "reposicion_stock",
      version_receta: {
        ...(first.version_receta as Row),
        _count: { detalle_receta: 0 },
      },
    },
  ];
}

definePageSuite([
  {
    route: "/dashboard/costs",
    load: () => import("./page"),
    cases: [
      { name: "con datos" },
      {
        name: "sin datos: modulo sin informacion economica",
        data: {
          "costeo.count": 0,
          "costeo.aggregate": { _sum: { costo_total: null } },
          "costo_indirecto.aggregate": { _sum: { monto: null } },
          "margen_ganancia.count": 0,
          "rentabilidad.count": 0,
          "orden_trabajo.count": 0,
          "costeo.findMany": [],
        },
      },
      {
        name: "solo ordenes sin costeo: modulo operativo",
        data: {
          "costeo.count": 0,
          "costeo.aggregate": { _sum: { costo_total: null } },
          "margen_ganancia.count": 0,
          "rentabilidad.count": 0,
          "orden_trabajo.count": 3,
          "costeo.findMany": [],
        },
      },
    ],
  },
  {
    route: "/dashboard/costs/costings",
    load: () => import("./costings/page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros, estado rentable",
        searchParams: {
          q: "puerta",
          pedido: "PED00000003",
          orden: "OTR00000007",
          producto: "Puerta",
          from: "2026-07-01",
          to: "2026-07-31",
          estado: "rentable",
        },
      },
      { name: "estado pendiente", searchParams: { estado: "pendiente" } },
      { name: "estado margen bajo", searchParams: { estado: "margen_bajo" } },
      {
        name: "un costeo de cada origen",
        data: { "costeo.findMany": costingsByOrigin },
      },
      {
        name: "sin resultados",
        data: { "costeo.findMany": [], "costeo.count": 0 },
      },
    ],
  },
  {
    route: "/dashboard/costs/costings/[id]",
    load: () => import("./costings/[id]/page"),
    cases: [
      {
        name: "orden con receta, margenes y rentabilidad con margen bajo",
        params: { id: "COS00000001" },
      },
      {
        name: "rentable, con un costo indirecto anulado y sin precio final",
        params: { id: "COS00000001" },
        data: {
          "costeo.findUnique": costing((row) => {
            const indirect = firstOf(row, "costo_indirecto");
            const margin = firstOf(row, "margen_ganancia");
            const profitability = firstOf(row, "rentabilidad");

            return {
              ...row,
              costo_indirecto: [
                {
                  ...indirect,
                  criterio_prorrateo: null,
                  categoria: "desgaste_maquinaria",
                  observaciones: "Lote 7\n[ANULADO] 2026-07-01T10:00:00.000Z - Monto original: S/ 50.25.",
                },
                { ...indirect, id_costo_indirecto: "CIN00000002", categoria: "categoria-nueva" },
              ],
              margen_ganancia: [{ ...margin, precio_final: null, motivo_ajuste: null }],
              rentabilidad: [{ ...profitability, alerta_bajo_margen: false }],
            };
          }),
        },
      },
      {
        name: "sin indirectos, margenes ni rentabilidad",
        params: { id: "COS00000001" },
        data: {
          "costeo.findUnique": costing((row) => ({
            ...row,
            costo_unitario: null,
            costo_indirecto: [],
            margen_ganancia: [],
            rentabilidad: [],
          })),
        },
      },
      {
        name: "vista previa con costo total en cero: margen bajo",
        params: { id: "COS00000001" },
        data: {
          "costeo.findUnique": costing((row) => ({
            ...row,
            costo_total: D("0.00"),
            rentabilidad: [],
          })),
        },
      },
      {
        name: "margen con precio final: la vista previa usa el precio final",
        params: { id: "COS00000001" },
        data: {
          "costeo.findUnique": costing((row) => ({
            ...row,
            costo_total: D("1000.00"),
            margen_ganancia: [
              {
                ...firstOf(row, "margen_ganancia"),
                porcentaje_margen: D("18.00"),
                precio_sugerido: D("1180.00"),
                precio_final: D("1250.00"),
              },
            ],
          })),
        },
      },
      {
        name: "orden con cliente directo y sin receta",
        params: { id: "COS00000002" },
        data: {
          "costeo.findUnique": costing((row) => ({
            ...row,
            orden_trabajo: {
              ...(row.orden_trabajo as Row),
              detalle_pedido: null,
              version_receta: null,
            },
          })),
        },
      },
      {
        name: "costeo de un pedido sin orden",
        params: { id: "COS00000003" },
        data: {
          "costeo.findUnique": costing((row) => ({ ...row, orden_trabajo: null })),
        },
      },
      {
        name: "costeo manual",
        params: { id: "COS00000004" },
        data: {
          "costeo.findUnique": costing((row) => ({
            ...row,
            orden_trabajo: null,
            pedido: null,
          })),
        },
      },
      {
        name: "inexistente",
        params: { id: "COS99999999" },
        data: { "costeo.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/costs/work-orders",
    load: () => import("./work-orders/page"),
    cases: [
      { name: "con ordenes" },
      {
        name: "origenes y una version sin materiales",
        data: { "orden_trabajo.findMany": costableOrdersByOrigin },
      },
      {
        name: "sin ordenes pendientes ni costeos",
        data: { "orden_trabajo.findMany": [], "costeo.findMany": [] },
      },
    ],
  },
]);
