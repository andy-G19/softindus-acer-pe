import { vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
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

// Entrega 10.4c: lo que pasa hoy antes de llevar el alta y la edicion a
// FormActionState. La edicion solo ofrece clientes y productos activos: si el
// del pedido se inactivo, el campo visible queda vacio y obligatorio aunque el
// oculto conserve su id (hallazgo 5 de la 10.4a; desde C3 se ofrecen marcados
// como inactivos). Los subtotales y el total se
// calculaban en coma flotante con toFixed (hallazgo 6): dos lineas de 1,25 x
// 10,25 mostraban 12.81 cada una y un total de 25.63; desde C2, la vista previa
// usa la regla de la base y el total es 25.62. Un pedido anulado sin
// proforma muestra el formulario, que la accion rechaza al guardar.
const editableWith = (changes: (order: Record<string, unknown>) => Record<string, unknown>) =>
  (args: PrismaArgs) => changes(editableOrder(args));

const withDetails = (order: Record<string, unknown>, details: Record<string, unknown>[]) => {
  const [first] = order.detalle_pedido as Array<Record<string, unknown>>;

  return {
    ...order,
    detalle_pedido: details.map((detail) => ({ ...first, ...detail })),
  };
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
    cases: [
      { name: "formulario" },
      {
        name: "sin clientes ni productos activos",
        data: { "cliente.findMany": [], "producto.findMany": [] },
      },
      { name: "sin productos activos", data: { "producto.findMany": [] } },
    ],
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
      {
        name: "cancelado redirige al detalle",
        params: { id: "PED00000001" },
        data: { "pedido.findUnique": editableWith((order) => ({ ...order, estado: "cancelado" })) },
      },
      {
        name: "anulado muestra el formulario",
        params: { id: "PED00000001" },
        data: { "pedido.findUnique": editableWith((order) => ({ ...order, estado: "anulado" })) },
      },
      {
        name: "cliente inactivo",
        params: { id: "PED00000001" },
        data: {
          "pedido.findUnique": editableWith((order) => ({
            ...order,
            id_cliente: "CLI00000099",
            cliente: {
              id_cliente: "CLI00000099",
              nombre_razon_social: "Cliente dado de baja",
              tipo_cliente: "ferreteria",
              estado: false,
            },
          })),
        },
      },
      {
        name: "producto inactivo",
        params: { id: "PED00000001" },
        data: {
          "pedido.findUnique": editableWith((order) =>
            withDetails(order, [
              {
                id_producto: "PRO00000099",
                producto: {
                  id_producto: "PRO00000099",
                  nombre_producto: "Producto dado de baja",
                  categoria: "herramientas",
                  unidad_medida: "unidad",
                  precio_referencial: new Prisma.Decimal("35.50"),
                  estado: false,
                },
              },
            ]),
          ),
        },
      },
      {
        name: "importes con decimales",
        params: { id: "PED00000001" },
        data: {
          "pedido.findUnique": editableWith((order) =>
            withDetails(order, [
              {
                id_producto: "id_producto-1",
                cantidad: new Prisma.Decimal("1.25"),
                precio_unitario: new Prisma.Decimal("10.25"),
                subtotal: new Prisma.Decimal("12.81"),
              },
              {
                id_producto: "id_producto-2",
                cantidad: new Prisma.Decimal("1.25"),
                precio_unitario: new Prisma.Decimal("10.25"),
                subtotal: new Prisma.Decimal("12.81"),
              },
            ]),
          ),
        },
      },
      {
        // C2: 1,25 x 1,02 = 1,275; toFixed mostraba 1.27 y la base guarda 1.28.
        name: "subtotal en empate",
        params: { id: "PED00000001" },
        data: {
          "pedido.findUnique": editableWith((order) =>
            withDetails(order, [
              {
                id_producto: "id_producto-1",
                cantidad: new Prisma.Decimal("1.25"),
                precio_unitario: new Prisma.Decimal("1.02"),
                subtotal: new Prisma.Decimal("1.28"),
              },
            ]),
          ),
        },
      },
    ],
  },
]);
