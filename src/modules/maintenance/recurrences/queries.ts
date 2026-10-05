import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura de la pagina de Reincidencias. No autorizan: la pagina
// que las llama ya verifico el rol con requireRole.

type RecurrencePeriod = {
  startOfMonth: Date;
  startOfToday: Date;
};

export async function getMaintenanceRecurrenceData({
  startOfMonth,
  startOfToday,
}: RecurrencePeriod) {
  const machines = await prisma.maquina.findMany({
    orderBy: {
      nombre: "asc",
    },
    include: {
      falla_maquina: {
        include: {
          reparacion: true,
        },
      },
      mantenimiento_preventivo: true,
    },
  });

  const monthlyFailures = await prisma.falla_maquina.count({
    where: {
      fecha_falla: {
        gte: startOfMonth,
      },
    },
  });

  const monthlyRepairCost = await prisma.reparacion.aggregate({
    where: {
      fecha_reparacion: {
        gte: startOfMonth,
      },
    },
    _sum: {
      costo_total: true,
    },
  });

  const overduePreventiveCount = await prisma.mantenimiento_preventivo.count({
    where: {
      estado: "pendiente",
      fecha_programada: {
        lt: startOfToday,
      },
    },
  });

  const pendingFailuresCount = await prisma.falla_maquina.count({
    where: {
      estado_atencion: {
        in: ["pendiente", "en_atencion"],
      },
    },
  });

  return {
    machines,
    monthlyFailures,
    monthlyRepairCost,
    overduePreventiveCount,
    pendingFailuresCount,
  };
}
