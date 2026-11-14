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

// Opciones de los filtros del reporte: las cajas y las categorias de gasto
// activas. Devuelve las promesas de Prisma en el orden en que las compone
// getFinancialReportData.
function findFinancialFilterOptions() {
  return [
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
  ] as const;
}

// Lecturas de los totales de caja chica y de compras por pagar (C7 de la 11.4b, D52): las sumas
// de ingresos y egresos de todos los movimientos del filtro y el total y los pagos de todas las
// compras pendientes, sin el limite de las filas que se muestran. La pagina y la exportacion las
// componen en su Promise.all y las resumen con summarizeFinancialTotals (financial-totals.ts).
function findFinancialTotals(wheres: ReturnType<typeof buildFinancialWheres>) {
  return [
    prisma.movimiento_caja.aggregate({
      where: { AND: [wheres.cashMovements, { tipo_movimiento: "ingreso" }] },
      _sum: { monto: true },
    }),

    prisma.movimiento_caja.aggregate({
      where: { AND: [wheres.cashMovements, { tipo_movimiento: "egreso" }] },
      _sum: { monto: true },
    }),

    prisma.compra.findMany({
      where: wheres.pendingPurchases,
      select: {
        monto_total: true,
        pago_proveedor: { select: { monto_pagado: true } },
      },
    }),
  ] as const;
}

// Solo las opciones de los filtros: la pantalla las necesita aunque no
// consulte los datos, con el rango de fechas invertido (entrega 10.2).
export async function getFinancialReportFilterOptions() {
  const [cashBoxes, categories] = await Promise.all(findFinancialFilterOptions());

  return { cashBoxes, categories };
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
    cashIncomeSum,
    cashExpenseSum,
    pendingPurchaseAmounts,
  ] = await Promise.all([
    ...findFinancialFilterOptions(),

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

    ...findFinancialTotals(wheres),
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
    cashIncomeSum,
    cashExpenseSum,
    pendingPurchaseAmounts,
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
    cashIncomeSum,
    cashExpenseSum,
    pendingPurchaseAmounts,
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

    // C7 de la 11.4b (D52): las compras pendientes ya no se cargan con el limite de las filas:
    // eran solo insumo del total de compras por pagar, que ahora sale de todas, con dos columnas
    // por compra.
    ...findFinancialTotals(wheres),
  ]);

  return {
    cashMovements,
    cashBalance,
    collectedPayments,
    productionCosts,
    estimatedProfit,
    receivables,
    cashIncomeSum,
    cashExpenseSum,
    pendingPurchaseAmounts,
  };
}
