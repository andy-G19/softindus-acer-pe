import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { findActiveProductFilterOptions } from "@/modules/commercial/products/queries";

// Consultas de lectura de las paginas de Campanas de produccion. No autorizan:
// la pagina que las llama ya verifico el rol con requireRole.

export type ProductionCampaignListFilters = {
  q: string;
  product: string;
  status: string;
  fromDate: Date | null;
  toDate: Date | null;
};

function buildProductionCampaignListWhere(
  filters: ProductionCampaignListFilters,
): Prisma.campania_produccionWhereInput {
  const { q, product, status, fromDate, toDate } = filters;
  const conditions: Prisma.campania_produccionWhereInput[] = [];

  if (q) {
    conditions.push({
      OR: [
        {
          id_campania: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_campania: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (product) {
    conditions.push({
      campania_detalle: {
        some: {
          id_producto: product,
        },
      },
    });
  }

  if (status) {
    conditions.push({
      estado: status,
    });
  }

  if (fromDate || toDate) {
    conditions.push({
      fecha_inicio: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

export async function getProductionCampaignListData(
  filters: ProductionCampaignListFilters,
) {
  const where = buildProductionCampaignListWhere(filters);

  const [campaigns, products] = await Promise.all([
    prisma.campania_produccion.findMany({
      where,
      include: {
        campania_detalle: {
          select: {
            cantidad_objetivo: true,
            cantidad_producida: true,
          },
        },
        _count: {
          select: {
            campania_detalle: true,
            orden_trabajo: true,
          },
        },
      },
      orderBy: [
        {
          fecha_inicio: "desc",
        },
        {
          id_campania: "desc",
        },
      ],
    }),
    findActiveProductFilterOptions(),
  ]);

  return { campaigns, products };
}

export async function getProductionCampaignDetail(idCampania: string) {
  return prisma.campania_produccion.findUnique({
    where: {
      id_campania: idCampania,
    },
    include: {
      campania_detalle: {
        include: {
          producto: true,
        },
        orderBy: {
          id_campania_detalle: "asc",
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
        },
        orderBy: {
          fecha_registro: "desc",
        },
        take: 8,
      },
    },
  });
}

export async function getProductionCampaignForEdit(idCampania: string) {
  return prisma.campania_produccion.findUnique({
    where: {
      id_campania: idCampania,
    },
  });
}

// Devuelve null si la campana no existe; los productos excluyen los que la
// campana ya tiene.
export async function getNewCampaignDetailData(idCampania: string) {
  const campaign = await prisma.campania_produccion.findUnique({
    where: {
      id_campania: idCampania,
    },
    include: {
      campania_detalle: {
        select: {
          id_producto: true,
        },
      },
    },
  });

  if (!campaign) {
    return null;
  }

  const existingProductIds = campaign.campania_detalle.map(
    (detail) => detail.id_producto,
  );

  const products = await prisma.producto.findMany({
    where: {
      estado: true,
      id_producto:
        existingProductIds.length > 0
          ? {
              notIn: existingProductIds,
            }
          : undefined,
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

  return { campaign, products };
}
