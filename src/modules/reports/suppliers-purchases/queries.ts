import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";
import { findActiveMaterialFilterOptions } from "@/modules/inventory/materials/queries";
import { findActiveSupplierOptions } from "@/modules/inventory/suppliers/queries";

// Consultas del reporte de Proveedores y compras. La pantalla y la exportacion
// comparten el filtro de compras; cada una conserva su limite, su orden y sus
// columnas. No autorizan: la pagina llama a requireRole y la ruta de
// exportacion valida el rol del reporte.

export type SuppliersPurchasesReportFilters = {
  dateFrom: string;
  dateTo: string;
  supplierId: string;
  materialId: string;
  purchaseStatus: string;
  paymentStatus: string;
  // Codigo de compra o comprobante ya en mayusculas.
  searchCode: string;
};

function buildPurchaseWhere(
  filters: SuppliersPurchasesReportFilters,
): Prisma.compraWhereInput {
  const dateRange = buildReportDateRange(filters.dateFrom, filters.dateTo);

  return {
    ...(dateRange ? { fecha_compra: dateRange } : {}),
    ...(filters.supplierId ? { id_proveedor: filters.supplierId } : {}),
    ...(filters.purchaseStatus ? { estado_compra: filters.purchaseStatus } : {}),
    ...(filters.paymentStatus ? { estado_pago: filters.paymentStatus } : {}),
    ...(filters.materialId
      ? {
          detalle_compra: {
            some: {
              id_material: filters.materialId,
            },
          },
        }
      : {}),
    ...(filters.searchCode
      ? {
          OR: [
            {
              id_compra: {
                contains: filters.searchCode,
              },
            },
            {
              numero_comprobante: {
                contains: filters.searchCode,
              },
            },
          ],
        }
      : {}),
  };
}

export async function getSuppliersPurchasesReportData(
  filters: SuppliersPurchasesReportFilters,
) {
  const [suppliers, materials, purchases] = await Promise.all([
    findActiveSupplierOptions(),

    findActiveMaterialFilterOptions(),

    prisma.compra.findMany({
      where: buildPurchaseWhere(filters),
      orderBy: {
        fecha_compra: "desc",
      },
      take: 100,
      include: {
        proveedor: true,
        detalle_compra: {
          include: {
            material: true,
          },
          orderBy: {
            id_detalle_compra: "asc",
          },
        },
        pago_proveedor: {
          orderBy: {
            fecha_pago: "asc",
          },
        },
        historial_precio_proveedor: {
          include: {
            material: true,
          },
          orderBy: {
            fecha_registro: "desc",
          },
          take: 5,
        },
      },
    }),
  ]);

  return { suppliers, materials, purchases };
}

export function getSuppliersPurchasesExportRows(
  filters: SuppliersPurchasesReportFilters,
  limit: number,
) {
  return prisma.compra.findMany({
    where: buildPurchaseWhere(filters),
    orderBy: [{ fecha_compra: "desc" }, { id_compra: "desc" }],
    take: limit,
    include: {
      proveedor: true,
      usuario: {
        select: {
          nombres: true,
          apellidos: true,
        },
      },
      detalle_compra: {
        include: {
          material: true,
        },
      },
      pago_proveedor: true,
      historial_precio_proveedor: {
        include: {
          material: true,
        },
        orderBy: {
          fecha_registro: "desc",
        },
      },
    },
  });
}
