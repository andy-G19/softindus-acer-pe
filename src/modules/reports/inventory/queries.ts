import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";
import { findActiveMaterialFilterOptions } from "@/modules/inventory/materials/queries";
import { findActiveUserOptions } from "@/modules/users/queries";

// Consultas del reporte de Inventario. La pantalla y la exportacion comparten
// el filtro de movimientos; cada una conserva su limite, su orden y sus
// columnas. No autorizan: la pagina llama a requireRole y la ruta de
// exportacion valida el rol del reporte.

export type InventoryReportFilters = {
  dateFrom: string;
  dateTo: string;
  materialId: string;
  movementType: string;
  userId: string;
  // Codigo de orden de trabajo ya en mayusculas.
  workOrderCode: string;
};

function buildMovementWhere(
  filters: InventoryReportFilters,
): Prisma.movimiento_inventarioWhereInput {
  const dateRange = buildReportDateRange(filters.dateFrom, filters.dateTo);

  return {
    ...(dateRange ? { fecha_movimiento: dateRange } : {}),
    ...(filters.materialId ? { id_material: filters.materialId } : {}),
    ...(filters.movementType ? { tipo_movimiento: filters.movementType } : {}),
    ...(filters.userId ? { id_usuario_responsable: filters.userId } : {}),
    ...(filters.workOrderCode
      ? {
          id_orden_trabajo: {
            contains: filters.workOrderCode,
          },
        }
      : {}),
  };
}

export async function getInventoryReportData(filters: InventoryReportFilters) {
  const [materials, users, movements] = await Promise.all([
    findActiveMaterialFilterOptions(),

    findActiveUserOptions(),

    prisma.movimiento_inventario.findMany({
      where: buildMovementWhere(filters),
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 100,
      include: {
        material: true,
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
        compra: {
          include: {
            proveedor: true,
          },
        },
      },
    }),
  ]);

  return { materials, users, movements };
}

export function getInventoryExportRows(
  filters: InventoryReportFilters,
  limit: number,
) {
  return prisma.movimiento_inventario.findMany({
    where: buildMovementWhere(filters),
    orderBy: [{ fecha_movimiento: "desc" }, { id_movimiento: "desc" }],
    take: limit,
    include: {
      material: true,
      usuario: {
        select: {
          nombres: true,
          apellidos: true,
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
        },
      },
      compra: {
        include: {
          proveedor: true,
        },
      },
    },
  });
}
