import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura de las paginas de versiones de receta (listado, nueva
// version y requerimientos de materiales). No autorizan: la pagina que las
// llama ya verifico el rol con requireRole.

export async function getRecipeVersionsData(idReceta: string) {
  return prisma.receta_tecnica.findUnique({
    where: {
      id_receta: idReceta,
    },
    include: {
      producto: true,
      usuario: true,
      version_receta: {
        include: {
          usuario: true,
          detalle_receta: {
            include: {
              material: true,
            },
            orderBy: {
              id_detalle_receta: "asc",
            },
          },
          _count: {
            select: {
              detalle_receta: true,
              orden_trabajo: true,
            },
          },
        },
        orderBy: {
          fecha_version: "desc",
        },
      },
    },
  });
}

export async function getNewRecipeVersionData(idReceta: string) {
  const [recipe, materials] = await Promise.all([
    prisma.receta_tecnica.findUnique({
      where: {
        id_receta: idReceta,
      },
      include: {
        producto: true,
        version_receta: {
          include: {
            detalle_receta: {
              include: {
                material: true,
              },
              orderBy: {
                id_detalle_receta: "asc",
              },
            },
          },
          orderBy: {
            fecha_version: "desc",
          },
          take: 1,
        },
      },
    }),
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
        categoria: true,
        unidad_medida: true,
        costo_unitario_actual: true,
      },
    }),
  ]);

  return { recipe, materials };
}

export async function getMaterialRequirementsVersion(
  idReceta: string,
  idVersionReceta: string,
) {
  return prisma.version_receta.findFirst({
    where: {
      id_version_receta: idVersionReceta,
      id_receta: idReceta,
    },
    include: {
      receta_tecnica: {
        include: {
          producto: true,
        },
      },
      detalle_receta: {
        include: {
          material: true,
        },
        orderBy: {
          id_detalle_receta: "asc",
        },
      },
    },
  });
}
