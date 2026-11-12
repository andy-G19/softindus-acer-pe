import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { QUOTABLE_ORDER_STATES } from "@/modules/commercial/quotes/quote-rules";
import { buildDateRangeFilter } from "@/lib/search-params";
import { findClientFilterOptions } from "@/modules/commercial/clients/queries";
import { findOrderFilterOptions } from "@/modules/commercial/orders/queries";

// Consultas de lectura de las paginas de Proformas. No autorizan: la pagina
// que las llama ya verifico el rol con requireRole.

export type QuoteListFilters = {
  q: string;
  client: string;
  order: string;
  status: string;
  balance: string;
  from: Date | null;
  to: Date | null;
};

function buildQuoteListWhere(filters: QuoteListFilters): Prisma.proformaWhereInput {
  const { q, client, order, status, balance, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.proformaWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          numero_proforma: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          id_pedido: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          pedido: {
            cliente: {
              nombre_razon_social: {
                contains: q,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    });
  }

  if (client) {
    conditions.push({
      pedido: {
        id_cliente: client,
      },
    });
  }

  if (order) {
    conditions.push({ id_pedido: order });
  }

  if (status) {
    conditions.push({ estado: status });
  }

  if (balance === "pending") {
    conditions.push({
      saldo: {
        gt: 0,
      },
    });
  }

  if (balance === "paid") {
    conditions.push({
      saldo: 0,
    });
  }

  if (dateRange) {
    conditions.push({ fecha_emision: dateRange });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

// C3 de la 11.3c (D39): solo las columnas que muestra la tabla. Antes traia el cliente completo
// y las lineas del pedido con su producto, que el listado no usa.
export async function getQuoteListData(filters: QuoteListFilters) {
  const where = buildQuoteListWhere(filters);

  const [quotes, clients, orders] = await Promise.all([
    prisma.proforma.findMany({
      where,
      orderBy: {
        fecha_emision: "desc",
      },
      select: {
        id_proforma: true,
        numero_proforma: true,
        id_pedido: true,
        fecha_emision: true,
        monto_total: true,
        saldo: true,
        estado: true,
        pago_cliente: {
          select: {
            id_pago_cliente: true,
          },
        },
        comprobante_venta: {
          where: {
            estado: "emitido",
          },
          select: {
            id_comprobante: true,
            numero_comprobante: true,
            tipo_comprobante: true,
          },
        },
        pedido: {
          select: {
            cliente: {
              select: {
                nombre_razon_social: true,
              },
            },
          },
        },
      },
    }),
    findClientFilterOptions(),
    findOrderFilterOptions(),
  ]);

  return { quotes, clients, orders };
}

// Pedidos registrados o aprobados, con detalle y sin una proforma activa.
export async function getQuotableOrders() {
  return prisma.pedido.findMany({
    where: {
      estado: {
        in: QUOTABLE_ORDER_STATES,
      },
      detalle_pedido: {
        some: {},
      },
      proforma: {
        none: {
          estado: {
            in: ["vigente", "aceptada", "pagada"],
          },
        },
      },
    },
    orderBy: {
      fecha_pedido: "desc",
    },
    include: {
      cliente: true,
      detalle_pedido: {
        include: {
          producto: true,
        },
      },
    },
  });
}

export async function getQuoteDetail(idProforma: string) {
  return prisma.proforma.findUnique({
    where: {
      id_proforma: idProforma,
    },
    include: {
      comprobante_venta: {
        orderBy: {
          fecha_emision: "desc",
        },
      },
      pago_cliente: {
        orderBy: {
          fecha_pago: "desc",
        },
      },
      pedido: {
        include: {
          cliente: true,
          detalle_pedido: {
            include: {
              producto: true,
            },
          },
        },
      },
    },
  });
}
