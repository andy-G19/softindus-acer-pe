import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura del panel de Personal. No autorizan: la pagina que las
// llama ya verifico el rol con requireRole.

// today es el instante de referencia de la pagina: los indicadores del dia y
// del mes se calculan a partir de el.
export async function getStaffOverviewData(today: Date) {
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
    totalOperators,
    activeOperators,
    inactiveOperators,
    attendanceToday,
    absencesToday,
    tasksThisMonth,
    pendingPayrolls,
    latestOperators,
    latestAttendance,
  ] = await Promise.all([
    prisma.operario.count(),

    prisma.operario.count({
      where: {
        estado: "activo",
      },
    }),

    prisma.operario.count({
      where: {
        estado: {
          not: "activo",
        },
      },
    }),

    prisma.asistencia.count({
      where: {
        fecha: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
    }),

    prisma.asistencia.count({
      where: {
        fecha: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
        falta: true,
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

    prisma.planilla_pago.count({
      where: {
        estado_pago: "pendiente",
      },
    }),

    prisma.operario.findMany({
      orderBy: [
        {
          estado: "asc",
        },
        {
          apellidos: "asc",
        },
      ],
      take: 6,
      select: {
        id_operario: true,
        nombres: true,
        apellidos: true,
        cargo: true,
        modalidad_pago: true,
        estado: true,
      },
    }),

    prisma.asistencia.findMany({
      orderBy: {
        fecha: "desc",
      },
      take: 6,
      include: {
        operario: true,
      },
    }),
  ]);

  return {
    totalOperators,
    activeOperators,
    inactiveOperators,
    attendanceToday,
    absencesToday,
    tasksThisMonth,
    pendingPayrolls,
    latestOperators,
    latestAttendance,
  };
}
