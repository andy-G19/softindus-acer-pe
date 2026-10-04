import "server-only";

import { prisma } from "@/lib/db";
import { findOpenPettyCashBoxes } from "@/modules/petty-cash/boxes/queries";

// Consultas de lectura del Resumen mensual. No autorizan: la pagina que las
// llama ya verifico el rol con requireRole.

type MonthRange = {
  startOfMonth: Date;
  startOfNextMonth: Date;
};

export async function getPettyCashMonthlySummaryData({
  startOfMonth,
  startOfNextMonth,
}: MonthRange) {
  const monthDateFilter = {
    gte: startOfMonth,
    lt: startOfNextMonth,
  };

  const [
    cashMovements,
    collectedPayments,
    pendingBalances,
    productionCosts,
    profitability,
    openCashBoxes,
    latestCostings,
    latestPayments,
  ] = await Promise.all([
    prisma.movimiento_caja.findMany({
      where: {
        fecha_movimiento: monthDateFilter,
      },
      orderBy: [
        {
          fecha_movimiento: "desc",
        },
        {
          id_movimiento_caja: "desc",
        },
      ],
      include: {
        caja_chica: true,
        categoria_gasto: true,
        usuario: true,
      },
    }),

    prisma.pago_cliente.aggregate({
      where: {
        fecha_pago: monthDateFilter,
      },
      _count: {
        id_pago_cliente: true,
      },
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.proforma.aggregate({
      where: {
        saldo: {
          gt: 0,
        },
        estado: {
          not: "anulada",
        },
      },
      _count: {
        id_proforma: true,
      },
      _sum: {
        saldo: true,
      },
    }),

    prisma.costeo.aggregate({
      where: {
        fecha_costeo: monthDateFilter,
      },
      _count: {
        id_costeo: true,
      },
      _sum: {
        costo_materiales: true,
        costo_consumibles: true,
        costo_mano_obra: true,
        costo_indirecto_total: true,
        costo_total: true,
      },
    }),

    prisma.rentabilidad.aggregate({
      where: {
        fecha_calculo: monthDateFilter,
      },
      _count: {
        id_rentabilidad: true,
      },
      _sum: {
        ingreso_estimado: true,
        costo_total: true,
        utilidad_estimada: true,
      },
      _avg: {
        margen_real: true,
      },
    }),

    findOpenPettyCashBoxes(),

    prisma.costeo.findMany({
      where: {
        fecha_costeo: monthDateFilter,
      },
      orderBy: {
        fecha_costeo: "desc",
      },
      take: 5,
      include: {
        pedido: {
          include: {
            cliente: true,
          },
        },
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
      },
    }),

    prisma.pago_cliente.findMany({
      where: {
        fecha_pago: monthDateFilter,
      },
      orderBy: {
        fecha_pago: "desc",
      },
      take: 5,
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
      },
    }),
  ]);

  return {
    cashMovements,
    collectedPayments,
    pendingBalances,
    productionCosts,
    profitability,
    openCashBoxes,
    latestCostings,
    latestPayments,
  };
}
