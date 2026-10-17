import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";
import { findActiveUserOptions } from "@/modules/users/queries";

// Consultas del Historial de exportaciones. No autorizan: la pagina llama a
// requireRole.

export type ExportHistoryFilters = {
  dateFrom: string;
  dateTo: string;
  reportModule: string;
  format: string;
  status: string;
  userId: string;
  searchText: string;
};

function buildExportHistoryWhere(
  filters: ExportHistoryFilters,
): Prisma.exportacion_datosWhereInput {
  const { reportModule, format, status, userId, searchText } = filters;
  const dateRangeFilter = buildReportDateRange(filters.dateFrom, filters.dateTo);

  return {
    ...(dateRangeFilter
      ? {
          fecha_exportacion: dateRangeFilter,
        }
      : {}),
    ...(reportModule ? { modulo_origen: reportModule } : {}),
    ...(format ? { formato: format } : {}),
    ...(status ? { estado: status } : {}),
    ...(userId ? { id_usuario: userId } : {}),
    ...(searchText
      ? {
          OR: [
            {
              modulo_origen: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
            {
              ruta_archivo: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
            {
              parametros: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
}

// Opciones de los filtros del historial. Devuelve las promesas de Prisma en el
// orden en que las compone getExportHistoryData.
function findExportHistoryFilterOptions() {
  return [findActiveUserOptions()] as const;
}

// Solo las opciones de los filtros: la pantalla las necesita aunque no
// consulte los datos, con el rango de fechas invertido (entrega 10.2).
export async function getExportHistoryFilterOptions() {
  const [users] = await Promise.all(findExportHistoryFilterOptions());

  return { users };
}

export async function getExportHistoryData(filters: ExportHistoryFilters) {
  const [users, exports] = await Promise.all([
    ...findExportHistoryFilterOptions(),

    prisma.exportacion_datos.findMany({
      where: buildExportHistoryWhere(filters),
      orderBy: {
        fecha_exportacion: "desc",
      },
      take: 150,
      include: {
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
            correo: true,
          },
        },
      },
    }),
  ]);

  return { users, exports };
}
