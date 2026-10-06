import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";
import { findActiveClientOptions } from "@/modules/commercial/clients/queries";

// Consultas del reporte de Ventas y cobranzas. La pantalla y la exportacion
// comparten el filtro de pedidos; cada una conserva su limite, su orden y sus
// columnas. El estado de cobranza se calcula y filtra en memoria despues de
// la consulta, en la pagina y en el exportador. No autorizan: la pagina llama
// a requireRole y la ruta de exportacion valida el rol del reporte.

export type SalesCollectionsReportFilters = {
  dateFrom: string;
  dateTo: string;
  clientId: string;
  orderStatus: string;
  // Codigo de pedido o proforma ya en mayusculas.
  searchCode: string;
};

function buildOrderWhere(
  filters: SalesCollectionsReportFilters,
): Prisma.pedidoWhereInput {
  const dateRange = buildReportDateRange(filters.dateFrom, filters.dateTo);

  return {
    ...(dateRange ? { fecha_pedido: dateRange } : {}),
    ...(filters.clientId ? { id_cliente: filters.clientId } : {}),
    ...(filters.orderStatus ? { estado: filters.orderStatus } : {}),
    ...(filters.searchCode
      ? {
          OR: [
            {
              id_pedido: {
                contains: filters.searchCode,
              },
            },
            {
              proforma: {
                some: {
                  OR: [
                    {
                      id_proforma: {
                        contains: filters.searchCode,
                      },
                    },
                    {
                      numero_proforma: {
                        contains: filters.searchCode,
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };
}

export async function getSalesCollectionsReportData(
  filters: SalesCollectionsReportFilters,
) {
  const [clients, orders] = await Promise.all([
    findActiveClientOptions(),

    prisma.pedido.findMany({
      where: buildOrderWhere(filters),
      orderBy: {
        fecha_pedido: "desc",
      },
      take: 100,
      include: {
        cliente: true,
        proforma: {
          orderBy: {
            fecha_emision: "desc",
          },
          include: {
            pago_cliente: {
              orderBy: {
                fecha_pago: "asc",
              },
            },
            comprobante_venta: true,
          },
        },
        detalle_pedido: {
          include: {
            producto: true,
          },
        },
      },
    }),
  ]);

  return { clients, orders };
}

export function getSalesCollectionsExportRows(
  filters: SalesCollectionsReportFilters,
  limit: number,
) {
  return prisma.pedido.findMany({
    where: buildOrderWhere(filters),
    orderBy: [{ fecha_pedido: "desc" }, { id_pedido: "desc" }],
    take: limit,
    include: {
      cliente: true,
      proforma: {
        orderBy: {
          fecha_emision: "desc",
        },
        include: {
          pago_cliente: true,
          comprobante_venta: true,
        },
      },
    },
  });
}
