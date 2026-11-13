import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";
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
    // C6 de la 11.3c (D41): tambien el numero de la proforma (PF-…), que es lo que ve el usuario;
    // el id interno sigue sirviendo.
    conditions.push({
      OR: [
        { id_pedido: { contains: q, mode: "insensitive" } },
        { id_proforma: { contains: q, mode: "insensitive" } },
        { proforma: { numero_proforma: { contains: q, mode: "insensitive" } } },
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

// C3 de la 11.3c (D39): solo las columnas que muestra la tabla. Antes traia la proforma, el
// pedido y el cliente completos para mostrar el nombre del cliente.
// C4 de la 11.3c (D38, hallazgo 9 de la 10.4a): pagina con el total contado con el mismo filtro y
// el id como desempate de los pagos del mismo dia.
export async function getCustomerPaymentListData(
  filters: CustomerPaymentListFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const conditions = buildCustomerPaymentListConditions(filters);
  const where: Prisma.pago_clienteWhereInput = conditions.length > 0 ? { AND: conditions } : {};

  const [payments, totalItems, clients, orders] = await Promise.all([
    prisma.pago_cliente.findMany({
      where,
      orderBy: [{ fecha_pago: "desc" }, { id_pago_cliente: "desc" }],
      skip,
      take,
      select: {
        id_pago_cliente: true,
        id_pedido: true,
        id_proforma: true,
        fecha_pago: true,
        tipo_pago: true,
        metodo_pago: true,
        monto_pagado: true,
        saldo_actual: true,
        proforma: {
          select: {
            numero_proforma: true,
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
        },
      },
    }),
    prisma.pago_cliente.count({ where }),
    findClientFilterOptions(),
    findOrderFilterOptions(),
  ]);

  return { payments, totalItems, clients, orders };
}
