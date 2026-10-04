import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Consultas de lectura de las paginas de Operarios. No autorizan: la pagina
// que las llama ya verifico el rol con requireRole.

export type OperatorListFilters = {
  q: string;
  cargo: string;
  especialidad: string;
  modalidad: string;
  status: string;
};

function buildOperatorListWhere(
  filters: OperatorListFilters,
): Prisma.operarioWhereInput {
  const { q, cargo, especialidad, modalidad, status } = filters;
  const conditions: Prisma.operarioWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          nombres: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          apellidos: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          cargo: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          telefono: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (cargo) {
    conditions.push({
      cargo,
    });
  }

  if (especialidad) {
    conditions.push({
      especialidad,
    });
  }

  if (modalidad) {
    conditions.push({
      modalidad_pago: modalidad,
    });
  }

  if (status) {
    conditions.push({
      estado: status,
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getOperatorListData(filters: OperatorListFilters) {
  const where = buildOperatorListWhere(filters);

  const [operators, cargos, especialidades, modalidades] = await Promise.all([
    prisma.operario.findMany({
      where,
      orderBy: [
        {
          estado: "asc",
        },
        {
          apellidos: "asc",
        },
        {
          nombres: "asc",
        },
      ],
      include: {
        _count: {
          select: {
            asistencia: true,
            tarea_operario: true,
            planilla_pago: true,
          },
        },
      },
    }),
    prisma.operario.findMany({
      where: {
        cargo: {
          not: null,
        },
      },
      distinct: ["cargo"],
      orderBy: {
        cargo: "asc",
      },
      select: {
        cargo: true,
      },
    }),
    prisma.operario.findMany({
      where: {
        especialidad: {
          not: null,
        },
      },
      distinct: ["especialidad"],
      orderBy: {
        especialidad: "asc",
      },
      select: {
        especialidad: true,
      },
    }),
    prisma.operario.findMany({
      distinct: ["modalidad_pago"],
      orderBy: {
        modalidad_pago: "asc",
      },
      select: {
        modalidad_pago: true,
      },
    }),
  ]);

  return { operators, cargos, especialidades, modalidades };
}

export async function getOperatorForEdit(idOperario: string) {
  return prisma.operario.findUnique({
    where: {
      id_operario: idOperario,
    },
  });
}

// Operarios activos, por apellidos y nombres, para los formularios de
// asistencia y tareas. Devuelve la promesa de Prisma.
export function findActiveOperators() {
  return prisma.operario.findMany({
    where: {
      estado: "activo",
    },
    orderBy: [
      {
        apellidos: "asc",
      },
      {
        nombres: "asc",
      },
    ],
  });
}
