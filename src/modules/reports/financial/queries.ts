import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";

// Consultas del reporte Financiero. La pantalla y la exportacion comparten el
// filtro de movimientos de caja y el significado de cada total (cobrado,
// costo de produccion, utilidad estimada, cuentas por cobrar y compras por
// pagar); cada una conserva su limite, su orden y sus columnas. No autorizan:
// la pagina llama a requireRole y la ruta de exportacion valida el rol del
// reporte.

const ACTIVE_PROFORMA_STATES = ["vigente", "aceptada"];
const PENDING_PURCHASE_PAYMENT_STATES = ["pendiente", "parcial"];

export type FinancialReportFilters = {
  dateFrom: string;
  dateTo: string;
  cashBoxId: string;
  movementType: string;
  categoryId: string;
  searchText: string;
};

function buildCashMovementWhere(
  filters: FinancialReportFilters,
  dateRange: ReturnType<typeof buildReportDateRange>,
): Prisma.movimiento_cajaWhereInput {
  return {
    ...(dateRange ? { fecha_movimiento: dateRange } : {}),
    ...(filters.cashBoxId ? { id_caja_chica: filters.cashBoxId } : {}),
    ...(filters.movementType ? { tipo_movimiento: filters.movementType } : {}),
    ...(filters.categoryId ? { id_categoria_gasto: filters.categoryId } : {}),
    ...(filters.searchText
      ? {
          OR: [
            {
              concepto: {
                contains: filters.searchText,
                mode: "insensitive" as const,
              },
            },
            {
              responsable: {
                contains: filters.searchText,
                mode: "insensitive" as const,
              },
            },
            {
              comprobante: {
                contains: filters.searchText,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
}

function buildFinancialWheres(filters: FinancialReportFilters) {
  const dateRange = buildReportDateRange(filters.dateFrom, filters.dateTo);

  return {
    dateRange,
    cashMovements: buildCashMovementWhere(filters, dateRange),
    collectedPayments: {
      ...(dateRange ? { fecha_pago: dateRange } : {}),
    } satisfies Prisma.pago_clienteWhereInput,
    productionCosts: {
      ...(dateRange ? { fecha_costeo: dateRange } : {}),
    } satisfies Prisma.costeoWhereInput,
    estimatedProfit: {
      ...(dateRange ? { fecha_calculo: dateRange } : {}),
    } satisfies Prisma.rentabilidadWhereInput,
    receivables: {
      estado: {
        in: ACTIVE_PROFORMA_STATES,
      },
      saldo: {
        gt: 0,
      },
      ...(dateRange ? { fecha_emision: dateRange } : {}),
    } satisfies Prisma.proformaWhereInput,
    pendingPurchases: {
      estado_pago: {
        in: PENDING_PURCHASE_PAYMENT_STATES,
      },
      estado_compra: {
        not: "anulada",
      },
      ...(dateRange ? { fecha_compra: dateRange } : {}),
    } satisfies Prisma.compraWhereInput,
  };
}

export async function getFinancialReportData(filters: FinancialReportFilters) {
  const wheres = buildFinancialWheres(filters);
  const dateRangeFilter = wheres.dateRange;

  const [
    cashBoxes,
    categories,
    cashMovements,
    openCashBoxesBalance,
    collectedPayments,
    productionCosts,
    estimatedProfit,
    lowMarginAlerts,
    receivables,
    pendingSupplierPurchases,
  ] = await Promise.all([
    prisma.caja_chica.findMany({
      orderBy: {
        nombre_caja: "asc",
      },
      select: {
        id_caja_chica: true,
        nombre_caja: true,
      },
    }),

    prisma.categoria_gasto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_categoria: "asc",
      },
      select: {
        id_categoria_gasto: true,
        nombre_categoria: true,
      },
    }),

    prisma.movimiento_caja.findMany({
      where: wheres.cashMovements,
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 100,
      include: {
        caja_chica: true,
        categoria_gasto: true,
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
      },
    }),

    prisma.caja_chica.aggregate({
      where: {
        estado: "abierta",
      },
      _sum: {
        saldo_actual: true,
      },
    }),

    prisma.pago_cliente.aggregate({
      where: wheres.collectedPayments,
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.costeo.aggregate({
      where: wheres.productionCosts,
      _sum: {
        costo_total: true,
        costo_materiales: true,
        costo_consumibles: true,
        costo_mano_obra: true,
        costo_indirecto_total: true,
      },
    }),

    prisma.rentabilidad.aggregate({
      where: wheres.estimatedProfit,
      _sum: {
        ingreso_estimado: true,
        costo_total: true,
        utilidad_estimada: true,
      },
    }),

    prisma.rentabilidad.count({
      where: {
        alerta_bajo_margen: true,
        ...(dateRangeFilter
          ? {
              fecha_calculo: dateRangeFilter,
            }
          : {}),
      },
    }),

    prisma.proforma.aggregate({
      where: wheres.receivables,
      _sum: {
        saldo: true,
      },
    }),

    prisma.compra.findMany({
      where: wheres.pendingPurchases,
      include: {
        proveedor: true,
        pago_proveedor: true,
      },
      orderBy: {
        fecha_compra: "desc",
      },
      take: 100,
    }),
  ]);

  return {
    cashBoxes,
    categories,
    cashMovements,
    openCashBoxesBalance,
    collectedPayments,
    productionCosts,
    estimatedProfit,
    lowMarginAlerts,
    receivables,
    pendingSupplierPurchases,
  };
}

export async function getFinancialExportData(
  filters: FinancialReportFilters,
  limit: number,
) {
  const wheres = buildFinancialWheres(filters);

  const [
    cashMovements,
    cashBalance,
    collectedPayments,
    productionCosts,
    estimatedProfit,
    receivables,
    pendingPurchases,
  ] = await Promise.all([
    prisma.movimiento_caja.findMany({
      where: wheres.cashMovements,
      orderBy: [{ fecha_movimiento: "desc" }, { id_movimiento_caja: "desc" }],
      take: limit,
      include: {
        caja_chica: true,
        categoria_gasto: true,
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
      },
    }),

    prisma.caja_chica.aggregate({
      where: {
        estado: "abierta",
      },
      _sum: {
        saldo_actual: true,
      },
    }),

    prisma.pago_cliente.aggregate({
      where: wheres.collectedPayments,
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.costeo.aggregate({
      where: wheres.productionCosts,
      _sum: {
        costo_total: true,
      },
    }),

    prisma.rentabilidad.aggregate({
      where: wheres.estimatedProfit,
      _sum: {
        ingreso_estimado: true,
        costo_total: true,
        utilidad_estimada: true,
      },
    }),

    prisma.proforma.aggregate({
      where: wheres.receivables,
      _sum: {
        saldo: true,
      },
    }),

    prisma.compra.findMany({
      where: wheres.pendingPurchases,
      orderBy: [{ fecha_compra: "desc" }, { id_compra: "desc" }],
      // No son las filas exportadas (son insumo de un total agregado en
      // memoria), pero igual se acota: evita cargar todas las compras
      // pendientes de pago sin limite si la tabla crece mucho.
      take: limit,
      include: {
        proveedor: true,
        pago_proveedor: true,
      },
    }),
  ]);

  return {
    cashMovements,
    cashBalance,
    collectedPayments,
    productionCosts,
    estimatedProfit,
    receivables,
    pendingPurchases,
  };
}
