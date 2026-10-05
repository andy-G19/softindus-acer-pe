import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

// Consultas de lectura de las paginas de etapas de una ruta. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

export type RouteStageFilters = {
  q: string;
  requiresMachine: string;
  status: string;
};

function getBooleanFilter(value: string) {
  if (value === "yes") {
    return true;
  }

  if (value === "no") {
    return false;
  }

  return undefined;
}

function getStatusFilter(status: string) {
  if (status === "active") {
    return true;
  }

  if (status === "inactive") {
    return false;
  }

  return undefined;
}

function buildRouteStageConditions(filters: RouteStageFilters) {
  const { q, requiresMachine, status } = filters;
  const machineFilter = getBooleanFilter(requiresMachine);
  const statusFilter = getStatusFilter(status);
  const conditions: Prisma.etapa_rutaWhereInput[] = [];

  if (q) {
    conditions.push({
      nombre_etapa: {
        contains: q,
        mode: "insensitive",
      },
    });
  }

  if (machineFilter !== undefined) {
    conditions.push({
      requiere_maquina: machineFilter,
    });
  }

  if (statusFilter !== undefined) {
    conditions.push({
      estado: statusFilter,
    });
  }

  return conditions;
}

export async function getRouteStagesData(idRuta: string, filters: RouteStageFilters) {
  const conditions = buildRouteStageConditions(filters);

  return prisma.ruta_fabricacion.findUnique({
    where: {
      id_ruta: idRuta,
    },
    include: {
      producto: true,
      etapa_ruta: {
        where: conditions.length > 0 ? { AND: conditions } : undefined,
        include: {
          etapa_ruta_maquina: {
            select: {
              tiempo_maquina_minutos_unidad: true,
              maquina: {
                select: {
                  nombre: true,
                  estado: true,
                },
              },
            },
          },
          _count: {
            select: {
              avance_orden: true,
              tarea_operario: true,
            },
          },
        },
        orderBy: {
          orden_secuencia: "asc",
        },
      },
    },
  });
}

export async function getNewRouteStageData(idRuta: string) {
  const [route, machines] = await Promise.all([
    prisma.ruta_fabricacion.findUnique({
      where: {
        id_ruta: idRuta,
      },
      include: {
        producto: true,
        etapa_ruta: {
          orderBy: {
            orden_secuencia: "desc",
          },
          take: 1,
        },
      },
    }),

    // Solo maquinas asignables: una dada de baja o inactiva no debe ofrecerse.
    prisma.maquina.findMany({
      where: {
        estado: {
          notIn: ["dada_de_baja", "inactiva"],
        },
      },
      orderBy: {
        nombre: "asc",
      },
      select: {
        id_maquina: true,
        nombre: true,
        tipo: true,
        estado: true,
      },
    }),
  ]);

  return { route, machines };
}

// Devuelve null si la etapa no existe en la ruta indicada.
export async function getRouteStageEditData(idRuta: string, idEtapaRuta: string) {
  const stage = await prisma.etapa_ruta.findFirst({
    where: {
      id_etapa_ruta: idEtapaRuta,
      id_ruta: idRuta,
    },
    include: {
      ruta_fabricacion: {
        include: {
          producto: true,
        },
      },
      etapa_ruta_maquina: {
        select: {
          id_maquina: true,
          tiempo_maquina_minutos_unidad: true,
        },
      },
      _count: {
        select: {
          avance_orden: true,
          tarea_operario: true,
        },
      },
    },
  });

  if (!stage) {
    return null;
  }

  const assignment = stage.etapa_ruta_maquina[0];

  // La maquina ya asignada se incluye aunque hoy este dada de baja o inactiva:
  // quitarla del selector haria que editar cualquier otro campo borrara la
  // asignacion en silencio.
  const machines = await prisma.maquina.findMany({
    where: {
      OR: [
        {
          estado: {
            notIn: ["dada_de_baja", "inactiva"],
          },
        },
        ...(assignment ? [{ id_maquina: assignment.id_maquina }] : []),
      ],
    },
    orderBy: {
      nombre: "asc",
    },
    select: {
      id_maquina: true,
      nombre: true,
      tipo: true,
      estado: true,
    },
  });

  return { stage, machines };
}
