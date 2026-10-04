import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildDateRangeFilter } from "@/lib/search-params";
import { findClientFilterOptions } from "@/modules/commercial/clients/queries";
import { findOrderFilterOptions } from "@/modules/commercial/orders/queries";

// Consultas de lectura de la pagina de Pagos de clientes. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

export type CustomerPaymentListFilters = {
  q: string;
  client: string;
  order: string;
  method: string;
  type: string;
  from: Date | null;
  to: Date | null;
};

function buildCustomerPaymentListConditions(
  filters: CustomerPaymentListFilters,
) {
  const { q, client, order, method, type, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.pago_clienteWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { id_pedido: { contains: q, mode: "insensitive" } },
        { id_proforma: { contains: q, mode: "insensitive" } },
        {
          proforma: {
            pedido: {
              cliente: {
                nombre_razon_social: { contains: q, mode: "insensitive" },
              },
            },
          },
        },
      ],
    });
  }

  if (client) {
    conditions.push({
      proforma: {
        pedido: {
          id_cliente: client,
        },
      },
    });
  }

  if (order) {
    conditions.push({ id_pedido: order });
  }

  if (method) {
    conditions.push({ metodo_pago: method });
  }

  if (type) {
    conditions.push({ tipo_pago: type });
  }

  if (dateRange) {
    conditions.push({ fecha_pago: dateRange });
  }

  return conditions;
}

export async function getCustomerPaymentListData(
  filters: CustomerPaymentListFilters,
) {
  const conditions = buildCustomerPaymentListConditions(filters);

  const [payments, clients, orders] = await Promise.all([
    prisma.pago_cliente.findMany({
      where: conditions.length > 0 ? { AND: conditions } : {},
      orderBy: {
        fecha_pago: "desc",
      },
      include: {
        proforma: {
          include: {
            pedido: {
              include: {
                cliente: true,
              },
            },
          },
        },
        usuario: true,
      },
    }),
    findClientFilterOptions(),
    findOrderFilterOptions(),
  ]);

  return { payments, clients, orders };
}
