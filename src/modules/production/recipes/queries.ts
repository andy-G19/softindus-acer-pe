import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { findActiveProductFilterOptions } from "@/modules/commercial/products/queries";

// Consultas de lectura de las paginas de Recetas tecnicas. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

export type TechnicalRecipeListFilters = {
  q: string;
  product: string;
  status: string;
};

function buildTechnicalRecipeListWhere(
  filters: TechnicalRecipeListFilters,
): Prisma.receta_tecnicaWhereInput {
  const { q, product, status } = filters;
  const conditions: Prisma.receta_tecnicaWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          id_receta: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_receta: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          producto: {
            nombre_producto: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  if (product) {
    conditions.push({
      id_producto: product,
    });
  }

  if (status) {
    conditions.push({
      estado: status,
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getTechnicalRecipeListData(
  filters: TechnicalRecipeListFilters,
) {
  const where = buildTechnicalRecipeListWhere(filters);

  const [recipes, products] = await Promise.all([
    prisma.receta_tecnica.findMany({
      where,
      include: {
        producto: true,
        usuario: true,
        version_receta: {
          where: {
            estado: "vigente",
          },
          include: {
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
          take: 1,
        },
        _count: {
          select: {
            version_receta: true,
          },
        },
      },
      orderBy: {
        fecha_creacion: "desc",
      },
    }),
    findActiveProductFilterOptions(),
  ]);

  return { recipes, products };
}

export async function getNewTechnicalRecipeProducts() {
  return prisma.producto.findMany({
    where: {
      estado: true,
    },
    include: {
      receta_tecnica: {
        select: {
          id_receta: true,
          nombre_receta: true,
          estado: true,
        },
      },
    },
    orderBy: [
      {
        categoria: "asc",
      },
      {
        nombre_producto: "asc",
      },
    ],
  });
}
