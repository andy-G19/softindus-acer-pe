import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";
import { buildDateRangeFilter } from "@/lib/search-params";

// Consultas del reporte de Personal y planillas. No autorizan: la pagina
// llama a requireRole y la ruta de exportacion valida el rol del reporte.
//
// La pantalla y la exportacion filtran las planillas con reglas distintas
// (entrega 5): la pantalla combina condiciones con AND, lee las fechas con
// parseDateParam y cierra "hasta" al final del dia (lte); la exportacion usa
// un objeto plano, acepta alias de parametros y cierra "hasta" antes del dia
// siguiente (lt). Igualarlas cambia lo que se ve o se exporta: es un fix.

export type StaffReportFilters = {
  q: string;
  operario: string;
  modalidad: string;
  estado: string;
  from: Date | null;
  to: Date | null;
};

export async function getStaffReportData(filters: StaffReportFilters) {
  const { q, operario, modalidad, estado } = filters;
  const dateRange = buildDateRangeFilter(filters.from, filters.to);

  const payrollFilters: Prisma.planilla_pagoWhereInput[] = [];

  if (q) {
    payrollFilters.push({
      operario: {
        OR: [
          { nombres: { contains: q, mode: "insensitive" } },
          { apellidos: { contains: q, mode: "insensitive" } },
        ],
      },
    });
  }

  if (operario) {
    payrollFilters.push({ id_operario: operario });
  }

  if (modalidad) {
    payrollFilters.push({ modalidad_pago: modalidad });
  }

  if (estado) {
    payrollFilters.push({ estado_pago: estado });
  }

  if (dateRange) {
    payrollFilters.push({ periodo_inicio: dateRange });
  }

  const payrollWhere: Prisma.planilla_pagoWhereInput =
    payrollFilters.length > 0 ? { AND: payrollFilters } : {};

  const attendanceWhere: Prisma.asistenciaWhereInput = {
    ...(operario ? { id_operario: operario } : {}),
    ...(dateRange ? { fecha: dateRange } : {}),
  };

  const [operators, payrolls, attendanceCount, absenceCount, latenessCount] =
    await Promise.all([
      prisma.operario.findMany({
        where: {
          estado: "activo",
        },
        orderBy: [
          { apellidos: "asc" },
          { nombres: "asc" },
        ],
      }),
      prisma.planilla_pago.findMany({
        where: payrollWhere,
        orderBy: {
          fecha_generacion: "desc",
        },
        take: 100,
        include: {
          operario: true,
          historial_pago_operario: true,
        },
      }),
      prisma.asistencia.count({ where: attendanceWhere }),
      prisma.asistencia.count({ where: { ...attendanceWhere, falta: true } }),
      prisma.asistencia.count({ where: { ...attendanceWhere, tardanza: true } }),
    ]);

  return { operators, payrolls, attendanceCount, absenceCount, latenessCount };
}

export type StaffExportFilters = {
  dateFrom: string;
  dateTo: string;
  operatorId: string;
  payrollStatus: string;
  paymentMode: string;
  searchText: string;
};

export function getStaffExportRows(
  filters: StaffExportFilters,
  limit: number,
) {
  const { operatorId, payrollStatus, paymentMode, searchText } = filters;
  const dateRange = buildReportDateRange(filters.dateFrom, filters.dateTo);

  return prisma.planilla_pago.findMany({
    where: {
      ...(operatorId ? { id_operario: operatorId } : {}),
      ...(payrollStatus ? { estado_pago: payrollStatus } : {}),
      ...(paymentMode ? { modalidad_pago: paymentMode } : {}),
      ...(dateRange ? { periodo_inicio: dateRange } : {}),
      ...(searchText
        ? {
            operario: {
              OR: [
                { nombres: { contains: searchText, mode: "insensitive" } },
                { apellidos: { contains: searchText, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: [{ fecha_generacion: "desc" }, { id_planilla: "desc" }],
    take: limit,
    include: {
      operario: true,
      historial_pago_operario: true,
    },
  });
}
