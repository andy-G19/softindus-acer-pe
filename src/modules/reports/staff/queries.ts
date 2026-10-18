import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";
import { findActiveOperators } from "@/modules/staff/operators/queries";

// Consultas del reporte de Personal y planillas. No autorizan: la pagina
// llama a requireRole y la ruta de exportacion valida el rol del reporte.
//
// La pantalla y la exportacion reciben los mismos filtros, con los nombres
// de la URL de la pantalla, y comparten el filtro de planillas (grupo 4 de
// fixes): combina las condiciones con AND y cierra "hasta" antes del dia
// siguiente (lt), sin el hueco del ultimo milisegundo. Cada una conserva su
// limite, su orden y sus columnas.

export type StaffReportFilters = {
  q: string;
  operario: string;
  modalidad: string;
  estado: string;
  // Fechas "aaaa-mm-dd" tal como llegan en la URL.
  from: string;
  to: string;
};

function buildPayrollWhere(
  filters: StaffReportFilters,
): Prisma.planilla_pagoWhereInput {
  const { q, operario, modalidad, estado } = filters;
  const dateRange = buildReportDateRange(filters.from, filters.to);

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

  return payrollFilters.length > 0 ? { AND: payrollFilters } : {};
}

// Opciones de los filtros del reporte. Devuelve las promesas de Prisma en el
// orden en que las compone getStaffReportData.
function findStaffFilterOptions() {
  return [findActiveOperators()] as const;
}

// Solo las opciones de los filtros: la pantalla las necesita aunque no
// consulte los datos, con el rango de fechas invertido (entrega 10.2).
export async function getStaffReportFilterOptions() {
  const [operators] = await Promise.all(findStaffFilterOptions());

  return { operators };
}

export async function getStaffReportData(filters: StaffReportFilters) {
  const { operario } = filters;
  const dateRange = buildReportDateRange(filters.from, filters.to);
  const payrollWhere = buildPayrollWhere(filters);

  const attendanceWhere: Prisma.asistenciaWhereInput = {
    ...(operario ? { id_operario: operario } : {}),
    ...(dateRange ? { fecha: dateRange } : {}),
  };

  const [operators, payrolls, attendanceCount, absenceCount, latenessCount] =
    await Promise.all([
      ...findStaffFilterOptions(),
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

export function getStaffExportRows(
  filters: StaffReportFilters,
  limit: number,
) {
  return prisma.planilla_pago.findMany({
    where: buildPayrollWhere(filters),
    orderBy: [{ fecha_generacion: "desc" }, { id_planilla: "desc" }],
    take: limit,
    include: {
      operario: true,
      historial_pago_operario: true,
    },
  });
}
