import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";
import { buildReportDateRange } from "@/lib/reports/report-filters";
import { buildDateRangeFilter } from "@/lib/search-params";

// Consultas de lectura de la pagina de Auditoria (bitacora de operaciones) y
// de su exportacion. No autorizan: la pagina ya verifico el rol con
// requireRole y la ruta de exportacion valida el rol del reporte.

export type AuditLogFilters = {
  q: string;
  usuario: string;
  accion: string;
  entidad: string;
  from: Date | null;
  to: Date | null;
};

function buildAuditLogWhere(
  filters: AuditLogFilters,
): Prisma.bitacora_operacionWhereInput {
  const { q, usuario, accion, entidad, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.bitacora_operacionWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { detalle: { contains: q, mode: "insensitive" } },
        { accion: { contains: q, mode: "insensitive" } },
        { entidad_afectada: { contains: q, mode: "insensitive" } },
        { id_registro_afectado: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (usuario) {
    conditions.push({ id_usuario: usuario });
  }

  if (accion) {
    conditions.push({ accion });
  }

  if (entidad) {
    conditions.push({ entidad_afectada: entidad });
  }

  if (dateRange) {
    conditions.push({ fecha_hora: dateRange });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getAuditLogData(
  filters: AuditLogFilters,
  { skip, take }: Pick<PaginationParams, "skip" | "take">,
) {
  const where = buildAuditLogWhere(filters);

  const [
    users,
    actions,
    entities,
    logs,
    totalLogs,
    distinctUsers,
    distinctEntities,
  ] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: [{ apellidos: "asc" }, { nombres: "asc" }],
      select: {
        id_usuario: true,
        nombres: true,
        apellidos: true,
      },
    }),
    prisma.bitacora_operacion.findMany({
      distinct: ["accion"],
      orderBy: {
        accion: "asc",
      },
      select: {
        accion: true,
      },
    }),
    prisma.bitacora_operacion.findMany({
      distinct: ["entidad_afectada"],
      orderBy: {
        entidad_afectada: "asc",
      },
      select: {
        entidad_afectada: true,
      },
    }),
    prisma.bitacora_operacion.findMany({
      where,
      orderBy: [{ fecha_hora: "desc" }, { id_bitacora: "desc" }],
      skip,
      take,
      include: {
        usuario: {
          select: {
            nombres: true,
            apellidos: true,
          },
        },
      },
    }),
    prisma.bitacora_operacion.count({ where }),
    // Usuarios/entidades distintos dentro de TODO el conjunto filtrado (no
    // solo la pagina actual), para que las KPI sigan siendo correctas ahora
    // que la tabla esta paginada.
    prisma.bitacora_operacion.findMany({
      where,
      distinct: ["id_usuario"],
      select: { id_usuario: true },
    }),
    prisma.bitacora_operacion.findMany({
      where,
      distinct: ["entidad_afectada"],
      select: { entidad_afectada: true },
    }),
  ]);

  return {
    users,
    actions,
    entities,
    logs,
    totalLogs,
    distinctUsers,
    distinctEntities,
  };
}

// Filtro de la exportacion de la bitacora (entrega 5). Difiere del de la
// pagina: usa un objeto plano, acepta alias de parametros y cierra "hasta"
// antes del dia siguiente (lt) en lugar de al final del dia (lte).
// Igualarlos cambia el archivo exportado: es un fix.
export type AuditLogExportFilters = {
  dateFrom: string;
  dateTo: string;
  userId: string;
  action: string;
  entity: string;
  searchText: string;
};

export function getAuditLogExportRows(
  filters: AuditLogExportFilters,
  limit: number,
) {
  const { userId, action, entity, searchText } = filters;
  const dateRange = buildReportDateRange(filters.dateFrom, filters.dateTo);

  return prisma.bitacora_operacion.findMany({
    where: {
      ...(dateRange ? { fecha_hora: dateRange } : {}),
      ...(userId ? { id_usuario: userId } : {}),
      ...(action ? { accion: action } : {}),
      ...(entity ? { entidad_afectada: entity } : {}),
      ...(searchText
        ? {
            OR: [
              { detalle: { contains: searchText, mode: "insensitive" } },
              { entidad_afectada: { contains: searchText, mode: "insensitive" } },
              { accion: { contains: searchText, mode: "insensitive" } },
              { id_registro_afectado: { contains: searchText, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ fecha_hora: "desc" }, { id_bitacora: "desc" }],
    take: limit,
    include: {
      usuario: {
        select: {
          nombres: true,
          apellidos: true,
        },
      },
    },
  });
}
