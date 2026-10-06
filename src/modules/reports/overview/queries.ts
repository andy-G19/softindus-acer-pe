import "server-only";

import { prisma } from "@/lib/db";

// Consultas del panel de Reportes. No autorizan: la pagina llama a
// requireRole. La pagina conserva el instante actual (tambien muestra el
// periodo) y pasa los limites del dia y del mes.

const ACTIVE_WORK_ORDER_STATES = ["pendiente", "en_proceso", "pausada"];
const PENDING_ORDER_STATES = [
  "registrado",
  "aprobado",
  "en_produccion",
];
const OPEN_FAILURE_STATES = ["pendiente", "en_atencion"];
const ACTIVE_PROFORMA_STATES = ["vigente", "aceptada"];
const PENDING_PAYMENT_STATES = ["pendiente", "parcial"];

export type ReportsOverviewPeriod = {
  startOfToday: Date;
  startOfMonth: Date;
  startOfNextMonth: Date;
};

export async function getReportsOverviewData({
  startOfToday,
  startOfMonth,
  startOfNextMonth,
}: ReportsOverviewPeriod) {
  const [
    activeWorkOrders,
    overdueWorkOrders,
    finishedWorkOrdersThisMonth,
    pendingOrders,
    collectedThisMonth,
    issuedReceiptsThisMonth,
    issuedReceiptsAmountThisMonth,
    receivables,
    pendingReceivablesCount,
    activeStockAlerts,
    activeMaterials,
    pettyCashBalance,
    pettyCashIncomeThisMonth,
    pettyCashExpenseThisMonth,
    estimatedProfitThisMonth,
    lowMarginAlerts,
    openMachineFailures,
    overduePreventiveMaintenance,
    maintenanceCostThisMonth,
    pendingSupplierPurchases,
    pendingSupplierPurchaseAmount,
    latestWorkOrders,
    criticalMaterials,
    latestCashMovements,
  ] = await Promise.all([
    prisma.orden_trabajo.count({
      where: {
        estado: {
          in: ACTIVE_WORK_ORDER_STATES,
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          in: ACTIVE_WORK_ORDER_STATES,
        },
        fecha_entrega_estimada: {
          lt: startOfToday,
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "finalizada",
        fecha_entrega_real: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.pedido.count({
      where: {
        estado: {
          in: PENDING_ORDER_STATES,
        },
      },
    }),

    prisma.pago_cliente.aggregate({
      where: {
        fecha_pago: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.comprobante_venta.count({
      where: {
        estado: "emitido",
        fecha_emision: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.comprobante_venta.aggregate({
      where: {
        estado: "emitido",
        fecha_emision: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto_total: true,
      },
    }),

    prisma.proforma.aggregate({
      where: {
        estado: {
          in: ACTIVE_PROFORMA_STATES,
        },
        saldo: {
          gt: 0,
        },
      },
      _sum: {
        saldo: true,
      },
    }),

    prisma.proforma.count({
      where: {
        estado: {
          in: ACTIVE_PROFORMA_STATES,
        },
        saldo: {
          gt: 0,
        },
      },
    }),

    prisma.alerta_stock.count({
      where: {
        estado_alerta: "activa",
      },
    }),

    prisma.material.findMany({
      where: {
        estado: true,
      },
      select: {
        id_material: true,
        nombre_material: true,
        categoria: true,
        unidad_medida: true,
        stock_actual: true,
        stock_minimo: true,
        stock_reservado: true,
      },
      orderBy: {
        nombre_material: "asc",
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

    prisma.movimiento_caja.aggregate({
      where: {
        tipo_movimiento: "ingreso",
        fecha_movimiento: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto: true,
      },
    }),

    prisma.movimiento_caja.aggregate({
      where: {
        tipo_movimiento: "egreso",
        fecha_movimiento: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto: true,
      },
    }),

    prisma.rentabilidad.aggregate({
      where: {
        fecha_calculo: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        utilidad_estimada: true,
      },
    }),

    prisma.rentabilidad.count({
      where: {
        alerta_bajo_margen: true,
      },
    }),

    prisma.falla_maquina.count({
      where: {
        estado_atencion: {
          in: OPEN_FAILURE_STATES,
        },
      },
    }),

    prisma.mantenimiento_preventivo.count({
      where: {
        estado: "pendiente",
        fecha_programada: {
          lt: startOfToday,
        },
      },
    }),

    prisma.reparacion.aggregate({
      where: {
        fecha_reparacion: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        costo_total: true,
      },
    }),

    prisma.compra.count({
      where: {
        estado_pago: {
          in: PENDING_PAYMENT_STATES,
        },
        estado_compra: {
          not: "anulada",
        },
      },
    }),

    prisma.compra.aggregate({
      where: {
        estado_pago: {
          in: PENDING_PAYMENT_STATES,
        },
        estado_compra: {
          not: "anulada",
        },
      },
      _sum: {
        monto_total: true,
      },
    }),

    prisma.orden_trabajo.findMany({
      orderBy: {
        fecha_registro: "desc",
      },
      take: 5,
      include: {
        producto: true,
        cliente: true,
      },
    }),

    prisma.material.findMany({
      where: {
        estado: true,
      },
      select: {
        id_material: true,
        nombre_material: true,
        categoria: true,
        unidad_medida: true,
        stock_actual: true,
        stock_minimo: true,
        stock_reservado: true,
      },
      orderBy: {
        stock_actual: "asc",
      },
      take: 8,
    }),

    prisma.movimiento_caja.findMany({
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 5,
      include: {
        categoria_gasto: true,
      },
    }),
  ]);

  return {
    activeWorkOrders,
    overdueWorkOrders,
    finishedWorkOrdersThisMonth,
    pendingOrders,
    collectedThisMonth,
    issuedReceiptsThisMonth,
    issuedReceiptsAmountThisMonth,
    receivables,
    pendingReceivablesCount,
    activeStockAlerts,
    activeMaterials,
    pettyCashBalance,
    pettyCashIncomeThisMonth,
    pettyCashExpenseThisMonth,
    estimatedProfitThisMonth,
    lowMarginAlerts,
    openMachineFailures,
    overduePreventiveMaintenance,
    maintenanceCostThisMonth,
    pendingSupplierPurchases,
    pendingSupplierPurchaseAmount,
    latestWorkOrders,
    criticalMaterials,
    latestCashMovements,
  };
}
