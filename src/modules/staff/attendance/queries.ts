import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildDateRangeFilter } from "@/lib/search-params";

// Consultas de lectura de la pagina de Asistencia. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole.

export type AttendanceListFilters = {
  q: string;
  operario: string;
  estado: string;
  from: Date | null;
  to: Date | null;
};

function buildAttendanceListWhere(
  filters: AttendanceListFilters,
): Prisma.asistenciaWhereInput {
  const { q, operario, estado, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.asistenciaWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { id_asistencia: { contains: q, mode: "insensitive" } },
        {
          operario: {
            nombres: { contains: q, mode: "insensitive" },
          },
        },
        {
          operario: {
            apellidos: { contains: q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (operario) {
    conditions.push({
      id_operario: { contains: operario, mode: "insensitive" },
    });
  }

  if (estado === "presente") {
    conditions.push({ falta: false, tardanza: false });
  }

  if (estado === "tardanza") {
    conditions.push({ falta: false, tardanza: true });
  }

  if (estado === "falta") {
    conditions.push({ falta: true });
  }

  if (dateRange) {
    conditions.push({ fecha: dateRange });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

// today es el instante de referencia de la pagina para los indicadores del dia.
export async function getAttendanceListData(
  filters: AttendanceListFilters,
  today: Date,
) {
  const where = buildAttendanceListWhere(filters);

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

  const [
    totalAttendance,
    attendanceToday,
    absencesToday,
    latenessToday,
    latestAttendance,
  ] = await Promise.all([
    prisma.asistencia.count({ where }),

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

    prisma.asistencia.count({
      where: {
        fecha: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
        tardanza: true,
      },
    }),

    prisma.asistencia.findMany({
      where,
      orderBy: [
        {
          fecha: "desc",
        },
        {
          id_asistencia: "desc",
        },
      ],
      take: 50,
      include: {
        operario: true,
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
      },
    }),
  ]);

  return {
    totalAttendance,
    attendanceToday,
    absencesToday,
    latenessToday,
    latestAttendance,
  };
}
