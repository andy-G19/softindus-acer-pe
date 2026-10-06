import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";

// Consultas del reporte de Produccion. La pantalla y la exportacion comparten
// el filtro de ordenes de trabajo; cada una conserva su limite, su orden y sus
// columnas. No autorizan: la pagina llama a requireRole y la ruta de
// exportacion valida el rol del reporte.

export type ProductionReportFilters = {
  dateFrom: string;
  dateTo: string;
  productId: string;
  status: string;
  // Codigo de orden ya en mayusculas.
  orderCode: string;
};

function buildWorkOrderWhere(
  filters: ProductionReportFilters,
): Prisma.orden_trabajoWhereInput {
  const dateRange = buildReportDateRange(filters.dateFrom, filters.dateTo);

  return {
    ...(dateRange ? { fecha_inicio: dateRange } : {}),
    ...(filters.productId ? { id_producto: filters.productId } : {}),
    ...(filters.status ? { estado: filters.status } : {}),
    ...(filters.orderCode
      ? {
          id_orden_trabajo: {
            contains: filters.orderCode,
          },
        }
      : {}),
  };
}

export async function getProductionReportData(filters: ProductionReportFilters) {
  const [products, workOrders] = await Promise.all([
    prisma.producto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_producto: "asc",
      },
    }),

    prisma.orden_trabajo.findMany({
      where: buildWorkOrderWhere(filters),
      orderBy: [
        {
          fecha_inicio: "desc",
        },
        {
          fecha_registro: "desc",
        },
      ],
      take: 100,
      include: {
        producto: true,
        cliente: true,
        ruta_fabricacion: true,
        avance_orden: {
          select: {
            porcentaje_avance: true,
            estado_etapa: true,
          },
        },
      },
    }),
  ]);

  return { products, workOrders };
}

export function getProductionExportRows(
  filters: ProductionReportFilters,
  limit: number,
) {
  return prisma.orden_trabajo.findMany({
    where: buildWorkOrderWhere(filters),
    orderBy: [
      { fecha_inicio: "desc" },
      { fecha_registro: "desc" },
      { id_orden_trabajo: "desc" },
    ],
    take: limit,
    include: {
      producto: true,
      cliente: true,
      ruta_fabricacion: true,
      usuario: true,
      avance_orden: {
        select: {
          porcentaje_avance: true,
        },
      },
    },
  });
}
