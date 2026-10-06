import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildReportDateRange } from "@/lib/reports/report-filters";

// Consultas del reporte de Mantenimiento. La pantalla y la exportacion
// comparten el filtro de fallas y el de preventivos; cada una conserva su
// limite, su orden y sus columnas. No autorizan: la pagina llama a
// requireRole y la ruta de exportacion valida el rol del reporte.

export type MaintenanceReportFilters = {
  dateFrom: string;
  dateTo: string;
  machineId: string;
  failureStatus: string;
  repairStatus: string;
  preventiveStatus: string;
  searchText: string;
};

type DateRange = ReturnType<typeof buildReportDateRange>;

// La busqueda de fallas de la pantalla incluye el codigo interno de la
// maquina; la de la exportacion no. Es una divergencia conocida (entrega 5):
// igualarlas cambia el archivo exportado, asi que corresponde a un fix.
function buildFailureWhere(
  filters: MaintenanceReportFilters,
  dateRange: DateRange,
  { includeMachineCode }: { includeMachineCode: boolean },
): Prisma.falla_maquinaWhereInput {
  const searchText = filters.searchText;

  return {
    ...(dateRange ? { fecha_falla: dateRange } : {}),
    ...(filters.machineId ? { id_maquina: filters.machineId } : {}),
    ...(filters.failureStatus ? { estado_atencion: filters.failureStatus } : {}),
    ...(filters.repairStatus
      ? {
          reparacion: {
            some: {
              estado_reparacion: filters.repairStatus,
            },
          },
        }
      : {}),
    ...(searchText
      ? {
          OR: [
            {
              descripcion: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
            {
              responsable_registro: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
            {
              impacto_produccion: {
                contains: searchText,
                mode: "insensitive" as const,
              },
            },
            {
              maquina: {
                nombre: {
                  contains: searchText,
                  mode: "insensitive" as const,
                },
              },
            },
            ...(includeMachineCode
              ? [
                  {
                    maquina: {
                      codigo_interno: {
                        contains: searchText,
                        mode: "insensitive" as const,
                      },
                    },
                  },
                ]
              : []),
          ],
        }
      : {}),
  };
}

function buildRepairWhere(
  filters: MaintenanceReportFilters,
  dateRange: DateRange,
): Prisma.reparacionWhereInput {
  return {
    ...(dateRange ? { fecha_reparacion: dateRange } : {}),
    ...(filters.repairStatus ? { estado_reparacion: filters.repairStatus } : {}),
    ...(filters.machineId
      ? {
          falla_maquina: {
            id_maquina: filters.machineId,
          },
        }
      : {}),
  };
}

function buildPreventiveWhere(
  filters: MaintenanceReportFilters,
  dateRange: DateRange,
): Prisma.mantenimiento_preventivoWhereInput {
  return {
    ...(dateRange ? { fecha_programada: dateRange } : {}),
    ...(filters.machineId ? { id_maquina: filters.machineId } : {}),
    ...(filters.preventiveStatus ? { estado: filters.preventiveStatus } : {}),
  };
}

export async function getMaintenanceReportData(filters: MaintenanceReportFilters) {
  const dateRange = buildReportDateRange(filters.dateFrom, filters.dateTo);
  const failureWhere = buildFailureWhere(filters, dateRange, {
    includeMachineCode: true,
  });
  const repairWhere = buildRepairWhere(filters, dateRange);
  const preventiveWhere = buildPreventiveWhere(filters, dateRange);

  const [machines, failures, repairs, preventiveMaintenances] =
    await Promise.all([
      prisma.maquina.findMany({
        orderBy: {
          nombre: "asc",
        },
      }),

      prisma.falla_maquina.findMany({
        where: failureWhere,
        orderBy: {
          fecha_falla: "desc",
        },
        take: 100,
        include: {
          maquina: true,
          usuario: true,
          reparacion: {
            orderBy: {
              fecha_reparacion: "desc",
            },
            include: {
              detalle_repuesto_reparacion: {
                include: {
                  repuesto: true,
                },
              },
            },
          },
        },
      }),

      prisma.reparacion.findMany({
        where: repairWhere,
        orderBy: {
          fecha_reparacion: "desc",
        },
        take: 100,
        include: {
          falla_maquina: {
            include: {
              maquina: true,
            },
          },
          detalle_repuesto_reparacion: {
            include: {
              repuesto: true,
            },
          },
        },
      }),

      prisma.mantenimiento_preventivo.findMany({
        where: preventiveWhere,
        orderBy: {
          fecha_programada: "asc",
        },
        take: 100,
        include: {
          maquina: true,
          usuario: true,
        },
      }),
    ]);

  return { machines, failures, repairs, preventiveMaintenances };
}

export async function getMaintenanceExportData(
  filters: MaintenanceReportFilters,
  limit: number,
) {
  const dateRange = buildReportDateRange(filters.dateFrom, filters.dateTo);

  const [failures, preventives] = await Promise.all([
    prisma.falla_maquina.findMany({
      where: buildFailureWhere(filters, dateRange, { includeMachineCode: false }),
      orderBy: [{ fecha_falla: "desc" }, { id_falla: "desc" }],
      // La lista final combina fallas + preventivos: se acota cada consulta
      // al limite completo (el total combinado se vuelve a recortar al
      // armar el reporte final).
      take: limit,
      include: {
        maquina: true,
        usuario: true,
        reparacion: {
          include: {
            detalle_repuesto_reparacion: {
              include: {
                repuesto: true,
              },
            },
          },
        },
      },
    }),

    prisma.mantenimiento_preventivo.findMany({
      where: buildPreventiveWhere(filters, dateRange),
      orderBy: [{ fecha_programada: "asc" }, { id_mantenimiento: "desc" }],
      take: limit,
      include: {
        maquina: true,
        usuario: true,
      },
    }),
  ]);

  return { failures, preventives };
}
