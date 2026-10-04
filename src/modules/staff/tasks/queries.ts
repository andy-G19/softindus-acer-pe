import "server-only";

import { prisma } from "@/lib/db";
import { findActiveOperators } from "@/modules/staff/operators/queries";

// Consultas de lectura de las paginas de Tareas de operarios. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

// today es el instante de referencia de la pagina para los indicadores del dia
// y del mes.
export async function getOperatorTaskData(today: Date) {
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const startOfTomorrow = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  );

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const startOfNextMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1,
  );

  const [
    totalTasks,
    tasksToday,
    tasksThisMonth,
    finishedTasks,
    latestTasks,
  ] = await Promise.all([
    prisma.tarea_operario.count(),

    prisma.tarea_operario.count({
      where: {
        fecha_tarea: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
    }),

    prisma.tarea_operario.count({
      where: {
        fecha_tarea: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.tarea_operario.count({
      where: {
        estado: "terminada",
      },
    }),

    prisma.tarea_operario.findMany({
      orderBy: [
        {
          fecha_tarea: "desc",
        },
        {
          id_tarea_operario: "desc",
        },
      ],
      take: 50,
      include: {
        operario: true,
        etapa_ruta: true,
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
        orden_trabajo: {
          include: {
            producto: true,
            cliente: true,
          },
        },
      },
    }),
  ]);

  return { totalTasks, tasksToday, tasksThisMonth, finishedTasks, latestTasks };
}

export async function getNewOperatorTaskFormOptions() {
  const [operators, workOrders, stages] = await Promise.all([
    findActiveOperators(),

    prisma.orden_trabajo.findMany({
      where: {
        estado: {
          not: "anulada",
        },
      },
      orderBy: [
        {
          fecha_inicio: "desc",
        },
        {
          id_orden_trabajo: "desc",
        },
      ],
      take: 50,
      include: {
        producto: true,
        cliente: true,
        ruta_fabricacion: true,
      },
    }),

    prisma.etapa_ruta.findMany({
      where: {
        estado: true,
      },
      orderBy: [
        {
          ruta_fabricacion: {
            nombre_ruta: "asc",
          },
        },
        {
          orden_secuencia: "asc",
        },
      ],
      include: {
        ruta_fabricacion: {
          include: {
            producto: true,
          },
        },
      },
    }),
  ]);

  return { operators, workOrders, stages };
}
