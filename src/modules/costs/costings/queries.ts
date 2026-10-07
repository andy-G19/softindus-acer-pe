import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { buildDateRangeFilter } from "@/lib/search-params";

// Consultas de lectura de las paginas de Costeos y de Ordenes por costear. No
// autorizan: la pagina que las llama ya verifico el rol con requireRole.

export type CostingListFilters = {
  q: string;
  pedido: string;
  orden: string;
  producto: string;
  estado: string;
  from: Date | null;
  to: Date | null;
};

function buildCostingListWhere({
  q,
  pedido,
  orden,
  producto,
  estado,
  from,
  to,
}: CostingListFilters): Prisma.costeoWhereInput {
  const dateRange = buildDateRangeFilter(from, to);

  const filters: Prisma.costeoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_costeo: { contains: q, mode: "insensitive" } },
        { id_pedido: { contains: q, mode: "insensitive" } },
        { id_orden_trabajo: { contains: q, mode: "insensitive" } },
        {
          pedido: {
            cliente: {
              nombre_razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
        {
          orden_trabajo: {
            producto: {
              nombre_producto: { contains: q, mode: "insensitive" },
            },
          },
        },
        {
          orden_trabajo: {
            cliente: {
              nombre_razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (pedido) {
    filters.push({ id_pedido: { contains: pedido, mode: "insensitive" } });
  }

  if (orden) {
    filters.push({
      id_orden_trabajo: { contains: orden, mode: "insensitive" },
    });
  }

  if (producto) {
    filters.push({
      orden_trabajo: {
        producto: {
          nombre_producto: { contains: producto, mode: "insensitive" },
        },
      },
    });
  }

  if (dateRange) {
    filters.push({ fecha_costeo: dateRange });
  }

  if (estado === "pendiente") {
    filters.push({ rentabilidad: { none: {} } });
  }

  if (estado === "rentable") {
    filters.push({ rentabilidad: { some: { alerta_bajo_margen: false } } });
  }

  if (estado === "margen_bajo") {
    filters.push({ rentabilidad: { some: { alerta_bajo_margen: true } } });
  }

  const where: Prisma.costeoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  return where;
}

// Los 50 costeos mas recientes que cumplen los filtros y el total que los
// cumple. Se consultan en secuencia, como antes.
export async function getCostingListData(filters: CostingListFilters) {
  const where = buildCostingListWhere(filters);

  const costings = await prisma.costeo.findMany({
    where,
    orderBy: {
      fecha_costeo: "desc",
    },
    take: 50,
    include: {
      pedido: {
        include: {
          cliente: true,
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
          cliente: true,
          detalle_pedido: {
            include: {
              pedido: {
                include: {
                  cliente: true,
                },
              },
            },
          },
          campania_produccion: true,
        },
      },
      margen_ganancia: {
        orderBy: {
          fecha_aplicacion: "desc",
        },
        take: 1,
      },
      rentabilidad: {
        orderBy: {
          fecha_calculo: "desc",
        },
        take: 1,
      },
    },
  });

  const totalCostings = await prisma.costeo.count({ where });

  return { costings, totalCostings };
}

// El costeo con su origen (orden o pedido), la receta de la orden, los costos
// indirectos, los margenes y las rentabilidades.
export async function getCostingDetail(idCosteo: string) {
  return prisma.costeo.findUnique({
    where: {
      id_costeo: idCosteo,
    },
    include: {
      usuario: true,
      pedido: {
        include: {
          cliente: true,
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
          cliente: true,
          detalle_pedido: {
            include: {
              pedido: {
                include: {
                  cliente: true,
                },
              },
            },
          },
          version_receta: {
            include: {
              receta_tecnica: true,
              detalle_receta: {
                include: {
                  material: true,
                },
                orderBy: {
                  id_detalle_receta: "asc",
                },
              },
            },
          },
        },
      },
      costo_indirecto: {
        orderBy: {
          fecha_registro: "desc",
        },
      },
      margen_ganancia: {
        orderBy: {
          fecha_aplicacion: "desc",
        },
      },
      rentabilidad: {
        orderBy: {
          fecha_calculo: "desc",
        },
      },
    },
  });
}

// Ordenes con receta y sin costeo, ultimos costeos y totales de ordenes.
export async function getCostableWorkOrdersData() {
  const [
    workOrdersWithoutCosting,
    latestCostings,
    totalWorkOrders,
    workOrdersWithoutRecipe,
    workOrdersAlreadyCosted,
    anulledWorkOrders,
  ] = await Promise.all([
    prisma.orden_trabajo.findMany({
      where: {
        estado: {
          not: "anulada",
        },
        id_version_receta: {
          not: null,
        },
        version_receta: {
          estado: {
            not: "anulada",
          },
        },
        costeo: {
          none: {},
        },
      },
      include: {
        producto: true,
        cliente: true,
        campania_produccion: true,
        ruta_fabricacion: true,
        detalle_pedido: {
          include: {
            pedido: {
              include: {
                cliente: true,
              },
            },
          },
        },
        version_receta: {
          include: {
            receta_tecnica: true,
            _count: {
              select: {
                detalle_receta: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha_registro: "desc",
      },
    }),

    prisma.costeo.findMany({
      take: 5,
      orderBy: {
        fecha_costeo: "desc",
      },
      include: {
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
        pedido: {
          include: {
            cliente: true,
          },
        },
      },
    }),

    prisma.orden_trabajo.count(),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          not: "anulada",
        },
        id_version_receta: null,
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          not: "anulada",
        },
        costeo: {
          some: {},
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "anulada",
      },
    }),
  ]);

  return {
    workOrdersWithoutCosting,
    latestCostings,
    totalWorkOrders,
    workOrdersWithoutRecipe,
    workOrdersAlreadyCosted,
    anulledWorkOrders,
  };
}
