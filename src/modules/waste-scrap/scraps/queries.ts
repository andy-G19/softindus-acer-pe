import "server-only";

import { prisma } from "@/lib/db";
import {
  findActiveMaterialFilterOptions,
  findActiveMaterialStockOptions,
} from "@/modules/inventory/materials/queries";
import { findRecentWorkOrderOptions } from "@/modules/production/work-orders/queries";

// Consultas de lectura de las paginas de Chatarra. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole.

export type ScrapListFilters = {
  estado: string;
  material: string;
  query: string;
};

function buildScrapListWhere({ estado, material, query }: ScrapListFilters) {
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
              id_chatarra: {
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
              observaciones: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };
}

export async function getScrapListData(filters: ScrapListFilters) {
  const where = buildScrapListWhere(filters);

  const [
    materials,
    scraps,
    totalFiltered,
    totalScraps,
    chatarraAcumulada,
    chatarraVendida,
    filteredTotals,
  ] = await Promise.all([
    findActiveMaterialFilterOptions(),

    prisma.chatarra.findMany({
      where,
      orderBy: {
        fecha_registro: "desc",
      },
      include: {
        material: true,
        orden_trabajo: {
          select: {
            id_orden_trabajo: true,
            producto: {
              select: {
                nombre_producto: true,
              },
            },
          },
        },
        venta_chatarra: {
          orderBy: {
            fecha_venta: "desc",
          },
          take: 1,
        },
      },
    }),

    prisma.chatarra.count({
      where,
    }),

    prisma.chatarra.count(),

    prisma.chatarra.count({
      where: {
        estado: "acumulada",
      },
    }),

    prisma.chatarra.count({
      where: {
        estado: "vendida",
      },
    }),

    prisma.chatarra.aggregate({
      where,
      _sum: {
        peso_kg: true,
        cantidad: true,
      },
    }),
  ]);

  return {
    materials,
    scraps,
    totalFiltered,
    totalScraps,
    chatarraAcumulada,
    chatarraVendida,
    filteredTotals,
  };
}

export async function getNewScrapFormOptions() {
  const [materials, workOrders] = await Promise.all([
    findActiveMaterialStockOptions(),
    findRecentWorkOrderOptions(),
  ]);

  return { materials, workOrders };
}
