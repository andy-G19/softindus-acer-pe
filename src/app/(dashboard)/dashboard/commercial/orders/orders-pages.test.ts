import { vi } from "vitest";

import {
  definePageSuite,
  generatedResult,
  generatedRow,
  type DataOverrides,
  type PrismaArgs,
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

// Caracterizacion de Pedidos (entrega 4.2), escrita antes de mover sus
// consultas a modules/commercial/orders/queries.ts.

// Pedido sin proformas, comprobantes ni ordenes de trabajo: el unico caso en
// que la edicion muestra el formulario en lugar de redirigir al detalle.
const editableOrder = (args: Parameters<typeof generatedRow>[2]) => {
  const order = generatedRow("pedido", "findUnique", args);
  const details = order.detalle_pedido as Array<Record<string, unknown>>;

  return {
    ...order,
    estado: "registrado",
    proforma: [],
    comprobante_venta: [],
    detalle_pedido: details.map((detail) => ({ ...detail, orden_trabajo: [] })),
  };
};

// Entrega 10.4b: lo que pasa hoy antes de pasar la barra a FilterBar y
// DateRangeFields y el estado a Badge. Con el rango invertido la base no
// devuelve filas: el caso deja la lista vacia. Una fecha que no existe filtra
// desde el dia siguiente que da Date (el 30 de febrero, desde el 2 de marzo) y
// el dia 32 no filtra (hallazgo 4 de la 10.3c).
//
// Los datos generados dan a cada pedido una proforma activa, comprobantes y
// ordenes de trabajo, con estados que no existen: la lista nunca mostraba un
// estado real, «Sin proforma», «Editar», «Generar proforma» ni «Cancelar». El
// caso con un pedido por estado los fija antes de tocar la pagina.
const EMPTY_LIST: DataOverrides = {
  "pedido.findMany": [],
  "pedido.count": 0,
};

const ORDERS_BY_STATUS = (args: PrismaArgs) => {
  const [base] = generatedResult("pedido", "findMany", args) as Record<string, unknown>[];
  const details = base.detalle_pedido as Array<Record<string, unknown>>;
  const withoutWorkOrders = details.map((detail) => ({ ...detail, orden_trabajo: [] }));

  return [
    // Editable: sin proforma, comprobantes ni ordenes de trabajo.
    {
      ...base,
      id_pedido: "PED00000011",
      estado: "registrado",
      proforma: [],
      comprobante_venta: [],
      detalle_pedido: withoutWorkOrders,
    },
    // Con proforma activa.
    {
      ...base,
      id_pedido: "PED00000012",
      estado: "aprobado",
      comprobante_venta: [],
      detalle_pedido: withoutWorkOrders,
    },
    // En produccion: tiene ordenes de trabajo.
    { ...base, id_pedido: "PED00000013", estado: "en_produccion", proforma: [], comprobante_venta: [] },
    {
      ...base,
      id_pedido: "PED00000014",
      estado: "cancelado",
      proforma: [],
      comprobante_venta: [],
      detalle_pedido: withoutWorkOrders,
    },
    // Con comprobante y sin proforma activa: se puede generar otra, no editar.
    { ...base, id_pedido: "PED00000015", estado: "aprobado", proforma: [], detalle_pedido: withoutWorkOrders },
  ];
};

definePageSuite([
  {
    route: "/dashboard/commercial/orders",
    load: () => import("./page"),
    cases: [
      { name: "sin filtros" },
      {
        name: "todos los filtros",
        searchParams: {
          q: "PED",
          client: "CLI00000001",
          product: "PRO00000001",
          status: "aprobado",
          from: "2026-07-01",
          to: "2026-07-31",
          page: "2",
        },
      },
      {
        name: "rango invertido",
        searchParams: { from: "2026-07-31", to: "2026-07-01" },
        data: EMPTY_LIST,
      },
      {
        name: "fechas no validas",
        searchParams: { from: "2026-02-30", to: "2026-07-32" },
      },
      { name: "un pedido por estado", data: { "pedido.findMany": ORDERS_BY_STATUS } },
    ],
  },
  {
    route: "/dashboard/commercial/orders/new",
    load: () => import("./new/page"),
    cases: [{ name: "formulario" }],
  },
  {
    route: "/dashboard/commercial/orders/[id]",
    load: () => import("./[id]/page"),
    cases: [
      { name: "detalle", params: { id: "PED00000001" } },
      {
        name: "regreso al listado filtrado",
        params: { id: "PED00000001" },
        searchParams: { returnTo: "/dashboard/commercial/orders?status=aprobado" },
      },
      {
        name: "en produccion",
        params: { id: "PED00000001" },
        data: {
          "pedido.findUnique": (args: PrismaArgs) => ({
            ...generatedRow("pedido", "findUnique", args),
            estado: "en_produccion",
          }),
        },
      },
      {
        name: "inexistente",
        params: { id: "PED99999999" },
        data: { "pedido.findUnique": null },
      },
    ],
  },
  {
    route: "/dashboard/commercial/orders/[id]/edit",
    load: () => import("./[id]/edit/page"),
    cases: [
      { name: "con proforma redirige al detalle", params: { id: "PED00000001" } },
      {
        name: "editable",
        params: { id: "PED00000001" },
        data: { "pedido.findUnique": editableOrder },
      },
      {
        name: "inexistente",
        params: { id: "PED99999999" },
        data: { "pedido.findUnique": null },
      },
    ],
  },
]);
