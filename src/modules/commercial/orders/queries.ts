import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";
import { buildDateRangeFilter } from "@/lib/search-params";
import {
  findActiveClientOptions,
  findClientFilterOptions,
} from "@/modules/commercial/clients/queries";
import {
  findActiveProductOptions,
  findProductFilterOptions,
} from "@/modules/commercial/products/queries";

// Consultas de lectura de las paginas de Pedidos. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole.

export type OrderListFilters = {
  q: string;
  client: string;
  product: string;
  status: string;
  from: Date | null;
  to: Date | null;
};

function buildOrderListWhere(filters: OrderListFilters): Prisma.pedidoWhereInput {
  const { q, client, product, status, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.pedidoWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          id_pedido: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          cliente: {
            nombre_razon_social: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          detalle_pedido: {
            some: {
              producto: {
                nombre_producto: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ],
    });
  }

  if (client) {
    conditions.push({ id_cliente: client });
  }

  if (product) {
    conditions.push({
      detalle_pedido: {
        some: {
          id_producto: product,
        },
      },
    });
  }

  if (status) {
    conditions.push({ estado: status });
  }

  if (dateRange) {
    conditions.push({ fecha_pedido: dateRange });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getOrderListData(
  filters: OrderListFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const where = buildOrderListWhere(filters);

  const [orders, totalItems, clients, products] = await Promise.all([
    prisma.pedido.findMany({
      where,
      orderBy: [{ fecha_pedido: "desc" }, { id_pedido: "desc" }],
      skip,
      take,
      include: {
        cliente: true,
        comprobante_venta: {
          select: {
            id_comprobante: true,
          },
        },
        proforma: {
          where: {
            estado: {
              in: ["vigente", "aceptada", "pagada"],
            },
          },
          select: {
            id_proforma: true,
            numero_proforma: true,
            estado: true,
          },
        },
        detalle_pedido: {
          include: {
            producto: true,
            orden_trabajo: {
              select: {
                id_orden_trabajo: true,
              },
            },
          },
        },
      },
    }),
    prisma.pedido.count({ where }),
    findClientFilterOptions(),
    findProductFilterOptions(),
  ]);

  return { orders, totalItems, clients, products };
}

export async function getNewOrderFormOptions() {
  const clients = await findActiveClientOptions();
  const products = await findActiveProductOptions();

  return { clients, products };
}

export async function getOrderDetail(idPedido: string) {
  return prisma.pedido.findUnique({
    where: {
      id_pedido: idPedido,
    },
    include: {
      cliente: true,
      usuario: true,
      proforma: {
        orderBy: {
          fecha_emision: "desc",
        },
      },
      comprobante_venta: {
        orderBy: {
          fecha_emision: "desc",
        },
      },
      detalle_pedido: {
        include: {
          producto: true,
          orden_trabajo: {
            select: {
              id_orden_trabajo: true,
              estado: true,
            },
          },
        },
      },
    },
  });
}

export async function getOrderEditData(idPedido: string) {
  const [order, clients, products] = await Promise.all([
    prisma.pedido.findUnique({
      where: {
        id_pedido: idPedido,
      },
      include: {
        proforma: {
          select: {
            id_proforma: true,
          },
        },
        comprobante_venta: {
          select: {
            id_comprobante: true,
          },
        },
        detalle_pedido: {
          include: {
            producto: true,
            orden_trabajo: {
              select: {
                id_orden_trabajo: true,
              },
            },
          },
        },
      },
    }),
    findActiveClientOptions(),
    findActiveProductOptions(),
  ]);

  return { order, clients, products };
}

// Opciones de pedido que otras funcionalidades usan en sus filtros. Devuelve
// la promesa de Prisma para que el llamador la componga en su Promise.all.
export function findOrderFilterOptions() {
  return prisma.pedido.findMany({
    orderBy: {
      fecha_pedido: "desc",
    },
    select: {
      id_pedido: true,
    },
  });
}
