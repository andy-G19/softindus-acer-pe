import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Consultas de lectura de las paginas de Maquinas. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole.

export type MachineListFilters = {
  q: string;
  type: string;
  location: string;
  status: string;
};

function buildMachineListWhere(filters: MachineListFilters): Prisma.maquinaWhereInput {
  const { q, type, location, status } = filters;
  const conditions: Prisma.maquinaWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          nombre: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          codigo_interno: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (type) {
    conditions.push({
      tipo: type,
    });
  }

  if (location) {
    conditions.push({
      ubicacion: location,
    });
  }

  if (status) {
    conditions.push({
      estado: status,
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getMachineListData(filters: MachineListFilters) {
  const where = buildMachineListWhere(filters);

  const [machines, types, locations] = await Promise.all([
    prisma.maquina.findMany({
      where,
      orderBy: [
        {
          estado: "asc",
        },
        {
          nombre: "asc",
        },
      ],
      include: {
        _count: {
          select: {
            falla_maquina: true,
            mantenimiento_preventivo: true,
            etapa_ruta_maquina: true,
          },
        },
      },
    }),
    prisma.maquina.findMany({
      distinct: ["tipo"],
      orderBy: {
        tipo: "asc",
      },
      select: {
        tipo: true,
      },
    }),
    prisma.maquina.findMany({
      where: {
        ubicacion: {
          not: null,
        },
      },
      distinct: ["ubicacion"],
      orderBy: {
        ubicacion: "asc",
      },
      select: {
        ubicacion: true,
      },
    }),
  ]);

  return { machines, types, locations };
}

export async function getMachineForEdit(idMaquina: string) {
  return prisma.maquina.findUnique({
    where: {
      id_maquina: idMaquina,
    },
  });
}

// Maquinas para los formularios de fallas y preventivos, ordenadas por estado
// y nombre. Devuelve la promesa de Prisma.
export function findMachineOptions() {
  return prisma.maquina.findMany({
    orderBy: [
      {
        estado: "asc",
      },
      {
        nombre: "asc",
      },
    ],
  });
}
