import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  findActiveProductFilterOptions,
  findActiveProductsByCategory,
} from "@/modules/commercial/products/queries";

// Consultas de lectura de las paginas de Rutas de fabricacion. No autorizan:
// la pagina que las llama ya verifico el rol con requireRole.

export type FabricationRouteListFilters = {
  q: string;
  product: string;
  status: string;
};

function getStatusFilter(status: string) {
  if (status === "active") {
    return true;
  }

  if (status === "inactive") {
    return false;
  }

  return undefined;
}

function buildFabricationRouteListWhere(
  filters: FabricationRouteListFilters,
): Prisma.ruta_fabricacionWhereInput {
  const { q, product, status } = filters;
  const statusFilter = getStatusFilter(status);
  const conditions: Prisma.ruta_fabricacionWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          id_ruta: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_ruta: {
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

  if (statusFilter !== undefined) {
    conditions.push({
      estado: statusFilter,
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getFabricationRouteListData(
  filters: FabricationRouteListFilters,
) {
  const where = buildFabricationRouteListWhere(filters);

  const [routes, products] = await Promise.all([
    prisma.ruta_fabricacion.findMany({
      where,
      include: {
        producto: true,
        _count: {
          select: {
            etapa_ruta: true,
            orden_trabajo: true,
          },
        },
      },
      orderBy: [
        {
          estado: "desc",
        },
        {
          nombre_ruta: "asc",
        },
      ],
    }),
    findActiveProductFilterOptions(),
  ]);

  return { routes, products };
}

export async function getNewFabricationRouteProducts() {
  return findActiveProductsByCategory();
}

export async function getFabricationRouteEditData(idRuta: string) {
  const [route, products] = await Promise.all([
    prisma.ruta_fabricacion.findUnique({
      where: {
        id_ruta: idRuta,
      },
      include: {
        producto: true,
        _count: {
          select: {
            orden_trabajo: true,
          },
        },
      },
    }),
    findActiveProductsByCategory(),
  ]);

  return { route, products };
}
