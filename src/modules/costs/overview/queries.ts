import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura del panel de Costos. No autorizan: la pagina que las
// llama ya verifico el rol con requireRole.

// Indicadores, ultimos costeos y costeos con bajo margen. La pagina calcula el
// mes en curso con la zona horaria del proceso, como antes.
export async function getCostsOverviewData({
  startOfMonth,
  startOfNextMonth,
}: {
  startOfMonth: Date;
  startOfNextMonth: Date;
}) {
  const [
    totalCostings,
    costingsThisMonth,
    totalCostAmount,
    totalIndirectCosts,
    marginsApplied,
    profitabilityCalculations,
    lowMarginAlerts,
    workOrdersTotal,
    workOrdersWithoutRecipe,
    workOrdersWithoutCosting,
    latestCostings,
    latestLowMarginCostings,
  ] = await Promise.all([
    prisma.costeo.count(),

    prisma.costeo.count({
      where: {
        fecha_costeo: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.costeo.aggregate({
      _sum: {
        costo_total: true,
      },
    }),

    prisma.costo_indirecto.aggregate({
      _sum: {
        monto: true,
      },
    }),

    prisma.margen_ganancia.count(),

    prisma.rentabilidad.count(),

    prisma.rentabilidad.count({
      where: {
        alerta_bajo_margen: true,
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          not: "anulada",
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          not: "anulada",
        },
        id_version_receta: null,
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          not: "anulada",
        },
        id_version_receta: {
          not: null,
        },
        costeo: {
          none: {},
        },
      },
    }),

    prisma.costeo.findMany({
      orderBy: {
        fecha_costeo: "desc",
      },
      take: 6,
      include: {
        pedido: {
          include: {
            cliente: true,
          },
        },
        orden_trabajo: {
          include: {
            producto: true,
            cliente: true,
            detalle_pedido: {
              include: {
                pedido: {
                  include: {
                    cliente: true,
                  },
                },
              },
            },
          },
        },
        margen_ganancia: {
          orderBy: {
            fecha_aplicacion: "desc",
          },
          take: 1,
        },
        rentabilidad: {
          orderBy: {
            fecha_calculo: "desc",
          },
          take: 1,
        },
      },
    }),

    prisma.costeo.findMany({
      where: {
        rentabilidad: {
          some: {
            alerta_bajo_margen: true,
          },
        },
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
        rentabilidad: {
          where: {
            alerta_bajo_margen: true,
          },
          orderBy: {
            fecha_calculo: "desc",
          },
          take: 1,
        },
      },
    }),
  ]);

  return {
    totalCostings,
    costingsThisMonth,
    totalCostAmount,
    totalIndirectCosts,
    marginsApplied,
    profitabilityCalculations,
    lowMarginAlerts,
    workOrdersTotal,
    workOrdersWithoutRecipe,
    workOrdersWithoutCosting,
    latestCostings,
    latestLowMarginCostings,
  };
}
