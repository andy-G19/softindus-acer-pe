import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura de las paginas de avances de una orden de trabajo. No
// autorizan: la pagina que las llama ya verifico el rol con requireRole.

// La orden con su ruta y sus avances, con operario, usuario y reasignaciones.
export async function getWorkOrderProgress(idOrdenTrabajo: string) {
  return prisma.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    include: {
      producto: true,
      ruta_fabricacion: {
        include: {
          etapa_ruta: {
            where: {
              estado: true,
            },
            orderBy: {
              orden_secuencia: "asc",
            },
          },
        },
      },
      avance_orden: {
        include: {
          etapa_ruta: true,
          operario: true,
          usuario: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
          reasignacion_tarea: {
            include: {
              operario_reasignacion_tarea_id_operario_anteriorTooperario: true,
              operario_reasignacion_tarea_id_operario_nuevoTooperario: true,
              usuario: {
                select: {
                  nombres: true,
                  apellidos: true,
                },
              },
            },
            orderBy: {
              fecha_reasignacion: "desc",
            },
          },
        },
      },
    },
  });
}

// El avance de la orden y los operarios activos a los que se puede reasignar:
// todos menos el actual. Devuelve null si el avance no existe o no es de esa
// orden, sin consultar operarios.
export async function getAdvanceReassignData(
  idOrdenTrabajo: string,
  idAvance: string,
) {
  const advance = await prisma.avance_orden.findFirst({
    where: {
      id_avance: idAvance,
      id_orden_trabajo: idOrdenTrabajo,
    },
    include: {
      etapa_ruta: true,
      operario: true,
      orden_trabajo: {
        include: {
          producto: true,
        },
      },
      reasignacion_tarea: {
        include: {
          operario_reasignacion_tarea_id_operario_anteriorTooperario: true,
          operario_reasignacion_tarea_id_operario_nuevoTooperario: true,
          usuario: {
            select: {
              nombres: true,
              apellidos: true,
            },
          },
        },
        orderBy: {
          fecha_reasignacion: "desc",
        },
        take: 5,
      },
    },
  });

  if (!advance) {
    return null;
  }

  const operators = await prisma.operario.findMany({
    where: {
      estado: "activo",
      id_operario: advance.id_operario
        ? {
            not: advance.id_operario,
          }
        : undefined,
    },
    orderBy: [
      {
        apellidos: "asc",
      },
      {
        nombres: "asc",
      },
    ],
    select: {
      id_operario: true,
      nombres: true,
      apellidos: true,
      cargo: true,
    },
  });

  return { advance, operators };
}
