import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { findActiveProductFilterOptions } from "@/modules/commercial/products/queries";

// Consultas de lectura de la pagina de Cuellos de botella. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

export type BottleneckFilters = {
  product: string;
  route: string;
  stage: string;
  orderStatus: string;
  fromDate: Date | null;
  toDate: Date | null;
};

function buildBottleneckConditions(filters: BottleneckFilters) {
  const { product, route, stage, orderStatus, fromDate, toDate } = filters;
  const conditions: Prisma.avance_ordenWhereInput[] = [
    {
      estado_etapa: "en_proceso",
    },
  ];

  if (product) {
    conditions.push({
      orden_trabajo: {
        id_producto: product,
      },
    });
  }

  if (route) {
    conditions.push({
      etapa_ruta: {
        id_ruta: route,
      },
    });
  }

  if (stage) {
    conditions.push({
      id_etapa_ruta: stage,
    });
  }

  if (orderStatus) {
    conditions.push({
      orden_trabajo: {
        estado: orderStatus,
      },
    });
  }

  if (fromDate || toDate) {
    conditions.push({
      fecha_inicio_etapa: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    });
  }

  return conditions;
}

export async function getProductionBottleneckData(filters: BottleneckFilters) {
  const conditions = buildBottleneckConditions(filters);

  const [activeAdvances, products, routes, stages] = await Promise.all([
    prisma.avance_orden.findMany({
      where: {
        AND: conditions,
      },
      include: {
        etapa_ruta: {
          include: {
            etapa_ruta_maquina: {
              select: {
                tiempo_maquina_minutos_unidad: true,
              },
            },
          },
        },
        operario: true,
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
      },
      orderBy: [
        {
          fecha_inicio_etapa: "asc",
        },
        {
          id_avance: "asc",
        },
      ],
    }),
    findActiveProductFilterOptions(),
    prisma.ruta_fabricacion.findMany({
      orderBy: {
        nombre_ruta: "asc",
      },
      select: {
        id_ruta: true,
        nombre_ruta: true,
      },
    }),
    prisma.etapa_ruta.findMany({
      orderBy: [
        {
          nombre_etapa: "asc",
        },
      ],
      select: {
        id_etapa_ruta: true,
        nombre_etapa: true,
      },
    }),
  ]);

  return { activeAdvances, products, routes, stages };
}
