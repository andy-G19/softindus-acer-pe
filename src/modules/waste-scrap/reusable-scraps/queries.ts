import "server-only";

import { prisma } from "@/lib/db";
import {
  findActiveMaterialFilterOptions,
  findActiveMaterialStockOptions,
} from "@/modules/inventory/materials/queries";
import { findRecentWorkOrderOptions } from "@/modules/production/work-orders/queries";

// Consultas de lectura de las paginas de Retazos reutilizables. No autorizan:
// la pagina que las llama ya verifico el rol con requireRole.

export type ReusableScrapListFilters = {
  estado: string;
  material: string;
  query: string;
};

function buildReusableScrapListWhere({
  estado,
  material,
  query,
}: ReusableScrapListFilters) {
  return {
    ...(estado
      ? {
          estado,
        }
      : {}),

    ...(material
      ? {
          id_material: material,
        }
      : {}),

    ...(query
      ? {
          OR: [
            {
              id_retazo: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              tipo_material: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              medida_aproximada: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              ubicacion: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              id_orden_trabajo: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
}

export async function getReusableScrapListData(filters: ReusableScrapListFilters) {
  const where = buildReusableScrapListWhere(filters);

  const [
    materials,
    retazos,
    totalFiltered,
    totalRetazos,
    retazosDisponibles,
    retazosReutilizados,
    retazosDescartados,
  ] = await Promise.all([
    findActiveMaterialFilterOptions(),

    prisma.retazo_reutilizable.findMany({
      where,
      orderBy: {
        fecha_registro: "desc",
      },
      include: {
        material: true,
        orden_trabajo: {
          include: {
            producto: true,
            cliente: true,
          },
        },
      },
    }),

    prisma.retazo_reutilizable.count({
      where,
    }),

    prisma.retazo_reutilizable.count(),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "disponible",
      },
    }),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "reutilizado",
      },
    }),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "descartado",
      },
    }),
  ]);

  return {
    materials,
    retazos,
    totalFiltered,
    totalRetazos,
    retazosDisponibles,
    retazosReutilizados,
    retazosDescartados,
  };
}

export async function getNewReusableScrapFormOptions() {
  const [materials, workOrders] = await Promise.all([
    findActiveMaterialStockOptions(),
    findRecentWorkOrderOptions(),
  ]);

  return { materials, workOrders };
}
