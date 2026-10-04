import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura del panel de Caja chica. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole.

// today es el instante de referencia de la pagina para los totales del mes.
export async function getPettyCashOverviewData(today: Date) {
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfNextMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1,
  );

  const [
    openBoxes,
    totalBoxes,
    activeCategories,
    currentBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlyMovements,
    latestBoxes,
    latestMovements,
  ] = await Promise.all([
    prisma.caja_chica.count({
      where: {
        estado: "abierta",
      },
    }),

    prisma.caja_chica.count(),

    prisma.categoria_gasto.count({
      where: {
        estado: true,
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

    prisma.movimiento_caja.count({
      where: {
        fecha_movimiento: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.caja_chica.findMany({
      orderBy: {
        fecha_apertura: "desc",
      },
      take: 5,
      select: {
        id_caja_chica: true,
        nombre_caja: true,
        saldo_actual: true,
        estado: true,
        fecha_apertura: true,
      },
    }),

    prisma.movimiento_caja.findMany({
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 8,
      include: {
        caja_chica: true,
        categoria_gasto: true,
      },
    }),
  ]);

  return {
    openBoxes,
    totalBoxes,
    activeCategories,
    currentBalance,
    monthlyIncome,
    monthlyExpenses,
    monthlyMovements,
    latestBoxes,
    latestMovements,
  };
}
