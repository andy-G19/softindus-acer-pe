import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { PaginationParams } from "@/lib/pagination";
import { buildReportDateRange } from "@/lib/reports/report-filters";

// Consultas de lectura de la pagina de Auditoria (bitacora de operaciones) y
// de su exportacion. No autorizan: la pagina ya verifico el rol con
// requireRole y la ruta de exportacion valida el rol del reporte.
//
// La pantalla y la exportacion reciben los mismos filtros, con los nombres de
// la URL de la pantalla, y comparten el filtro de la bitacora (grupo 4 de
// fixes). Cada una conserva su paginacion o limite y sus columnas.

export type AuditLogFilters = {
  q: string;
  usuario: string;
  accion: string;
  entidad: string;
  // Fechas "aaaa-mm-dd" tal como llegan en la URL.
  from: string;
  to: string;
};

function buildAuditLogWhere(
  filters: AuditLogFilters,
): Prisma.bitacora_operacionWhereInput {
  const { q, usuario, accion, entidad, from, to } = filters;
  // Como la exportacion: "hasta" se cierra antes del dia siguiente (lt). Con
  // lte a las 23:59:59.999 la pantalla perdia las entradas del ultimo
  // milisegundo del dia, porque fecha_hora guarda microsegundos (grupo 4 de
  // fixes).
  const dateRange = buildReportDateRange(from, to);
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

// Opciones de los filtros de la auditoria: todos los usuarios (tambien los
// inactivos, que siguen en la bitacora) y las acciones y entidades
// registradas. Devuelve las promesas de Prisma en el orden en que las compone
// getAuditLogData.
function findAuditFilterOptions() {
  return [
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
  ] as const;
}

// Solo las opciones de los filtros: la pantalla las necesita aunque no
// consulte los datos, con el rango de fechas invertido (entrega 10.2).
export async function getAuditLogFilterOptions() {
  const [users, actions, entities] = await Promise.all(findAuditFilterOptions());

  return { users, actions, entities };
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
    ...findAuditFilterOptions(),
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

export function getAuditLogExportRows(
  filters: AuditLogFilters,
  limit: number,
) {
  return prisma.bitacora_operacion.findMany({
    where: buildAuditLogWhere(filters),
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
