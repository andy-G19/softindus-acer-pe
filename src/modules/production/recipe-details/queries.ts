import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura de las paginas de detalle de una version de receta. No
// autorizan: la pagina que las llama ya verifico el rol con requireRole.

export async function getRecipeVersionDetails(
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
      _count: {
        select: {
          orden_trabajo: true,
        },
      },
    },
  });
}

// Devuelve null si la version no existe en la receta; los materiales excluyen
// los que la version ya usa.
export async function getNewRecipeDetailData(
  idReceta: string,
  idVersionReceta: string,
) {
  const version = await prisma.version_receta.findFirst({
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
        select: {
          id_material: true,
        },
      },
      _count: {
        select: {
          orden_trabajo: true,
        },
      },
    },
  });

  if (!version) {
    return null;
  }

  const usedMaterialIds = version.detalle_receta.map(
    (detail) => detail.id_material,
  );

  const materials = await prisma.material.findMany({
    where: {
      estado: true,
      id_material: {
        notIn: usedMaterialIds,
      },
    },
    orderBy: [
      {
        categoria: "asc",
      },
      {
        nombre_material: "asc",
      },
    ],
  });

  return { version, materials };
}

// Devuelve null si el detalle no existe o no pertenece a la receta indicada.
export async function getRecipeDetailEditData(
  idReceta: string,
  idVersionReceta: string,
  idDetalleReceta: string,
) {
  const detail = await prisma.detalle_receta.findFirst({
    where: {
      id_detalle_receta: idDetalleReceta,
      id_version_receta: idVersionReceta,
    },
    include: {
      material: true,
      version_receta: {
        include: {
          receta_tecnica: {
            include: {
              producto: true,
            },
          },
          detalle_receta: {
            select: {
              id_material: true,
            },
          },
          _count: {
            select: {
              orden_trabajo: true,
            },
          },
        },
      },
    },
  });

  if (!detail || detail.version_receta.id_receta !== idReceta) {
    return null;
  }

  // Los materiales ya usados en otras lineas se excluyen, pero el de esta linea
  // se conserva: si no, editar la cantidad obligaria a cambiar tambien el
  // material.
  const usedMaterialIds = detail.version_receta.detalle_receta
    .map((item) => item.id_material)
    .filter((materialId) => materialId !== detail.id_material);

  const materials = await prisma.material.findMany({
    where: {
      OR: [
        {
          estado: true,
          id_material: {
            notIn: usedMaterialIds,
          },
        },
        // El material actual se incluye aunque hoy este inactivo, para no
        // borrarlo en silencio al guardar cualquier otro cambio de la linea.
        { id_material: detail.id_material },
      ],
    },
    orderBy: [{ categoria: "asc" }, { nombre_material: "asc" }],
  });

  return { detail, materials };
}
