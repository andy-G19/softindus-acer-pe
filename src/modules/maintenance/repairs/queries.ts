import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildDateRangeFilter } from "@/lib/search-params";

// Consultas de lectura de las paginas de Reparaciones. No autorizan: la pagina
// que las llama ya verifico el rol con requireRole.

export type RepairListFilters = {
  q: string;
  machine: string;
  failure: string;
  status: string;
  from: Date | null;
  to: Date | null;
};

function buildRepairListWhere(filters: RepairListFilters): Prisma.reparacionWhereInput {
  const { q, machine, failure, status, from, to } = filters;
  const dateRange = buildDateRangeFilter(from, to);
  const conditions: Prisma.reparacionWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        { id_reparacion: { contains: q, mode: "insensitive" } },
        { tecnico_proveedor: { contains: q, mode: "insensitive" } },
        {
          falla_maquina: {
            descripcion: { contains: q, mode: "insensitive" },
          },
        },
        {
          falla_maquina: {
            maquina: {
              nombre: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (machine) {
    conditions.push({
      falla_maquina: {
        maquina: {
          nombre: { contains: machine, mode: "insensitive" },
        },
      },
    });
  }

  if (failure) {
    conditions.push({ id_falla: { contains: failure, mode: "insensitive" } });
  }

  if (status) {
    conditions.push({ estado_reparacion: status });
  }

  if (dateRange) {
    conditions.push({ fecha_reparacion: dateRange });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getRepairList(filters: RepairListFilters) {
  const where = buildRepairListWhere(filters);

  return prisma.reparacion.findMany({
    where,
    orderBy: {
      fecha_reparacion: "desc",
    },
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
  });
}

export async function getNewRepairFormOptions() {
  const failures = await prisma.falla_maquina.findMany({
    where: {
      estado_atencion: {
        in: ["pendiente", "en_atencion"],
      },
    },
    orderBy: {
      fecha_falla: "desc",
    },
    include: {
      maquina: true,
    },
  });

  const spareParts = await prisma.repuesto.findMany({
    where: {
      estado: true,
    },
    orderBy: {
      nombre_repuesto: "asc",
    },
    select: {
      id_repuesto: true,
      nombre_repuesto: true,
      costo_unitario: true,
    },
  });

  return { failures, spareParts };
}
