import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildDateRangeFilter } from "@/lib/search-params";

// Consultas de lectura de la pagina de Mantenimientos preventivos. No
// autorizan: la pagina que las llama ya verifico el rol con requireRole.

export type PreventiveMaintenanceListFilters = {
  q: string;
  machine: string;
  responsible: string;
  status: string;
  from: Date | null;
  to: Date | null;
};

function buildPreventiveMaintenanceListWhere(
  filters: PreventiveMaintenanceListFilters,
): Prisma.mantenimiento_preventivoWhereInput {
  const { q, machine, responsible, status, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.mantenimiento_preventivoWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { id_mantenimiento: { contains: q, mode: "insensitive" } },
        { actividad: { contains: q, mode: "insensitive" } },
        { responsable: { contains: q, mode: "insensitive" } },
        {
          maquina: {
            nombre: { contains: q, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (machine) {
    conditions.push({
      maquina: {
        nombre: { contains: machine, mode: "insensitive" },
      },
    });
  }

  if (responsible) {
    conditions.push({
      responsable: { contains: responsible, mode: "insensitive" },
    });
  }

  if (status) {
    conditions.push({ estado: status });
  }

  if (dateRange) {
    conditions.push({ fecha_programada: dateRange });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getPreventiveMaintenanceList(
  filters: PreventiveMaintenanceListFilters,
) {
  const where = buildPreventiveMaintenanceListWhere(filters);

  return prisma.mantenimiento_preventivo.findMany({
    where,
    orderBy: [
      {
        fecha_programada: "asc",
      },
      {
        estado: "asc",
      },
    ],
    include: {
      maquina: true,
      usuario: true,
    },
  });
}
