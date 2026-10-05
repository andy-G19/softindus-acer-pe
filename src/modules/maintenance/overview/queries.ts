import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura del panel de Mantenimiento. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole.

// today es el instante de referencia de la pagina: los indicadores del mes y
// los vencidos se calculan a partir de el.
export async function getMaintenanceOverviewData(today: Date) {
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const startOfNextMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1,
  );

  const [
    totalMachines,
    operationalMachines,
    openFailures,
    failuresThisMonth,
    pendingPreventiveMaintenance,
    overduePreventiveMaintenance,
    maintenanceCostsThisMonth,
    latestFailures,
    upcomingPreventiveMaintenance,
  ] = await Promise.all([
    prisma.maquina.count(),

    prisma.maquina.count({
      where: {
        estado: "operativa",
      },
    }),

    prisma.falla_maquina.count({
      where: {
        estado_atencion: {
          in: ["pendiente", "en_atencion"],
        },
      },
    }),

    prisma.falla_maquina.count({
      where: {
        fecha_falla: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.mantenimiento_preventivo.count({
      where: {
        estado: "pendiente",
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

    prisma.falla_maquina.findMany({
      orderBy: {
        fecha_falla: "desc",
      },
      take: 6,
      include: {
        maquina: true,
      },
    }),

    prisma.mantenimiento_preventivo.findMany({
      orderBy: {
        fecha_programada: "asc",
      },
      take: 6,
      include: {
        maquina: true,
      },
    }),
  ]);

  return {
    totalMachines,
    operationalMachines,
    openFailures,
    failuresThisMonth,
    pendingPreventiveMaintenance,
    overduePreventiveMaintenance,
    maintenanceCostsThisMonth,
    latestFailures,
    upcomingPreventiveMaintenance,
  };
}
