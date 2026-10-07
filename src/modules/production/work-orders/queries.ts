import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  findActiveProductFilterOptions,
  findActiveProductsByCategory,
} from "@/modules/commercial/products/queries";

// Consultas de lectura de las paginas de Ordenes de trabajo y de las opciones
// de ordenes que usan otras areas. No autorizan: la pagina que las llama ya
// verifico el rol con requireRole.

// Las 50 ordenes no anuladas mas recientes, con producto y cliente, para los
// formularios de chatarra y retazos. Devuelve la promesa de Prisma.
export function findRecentWorkOrderOptions() {
  return prisma.orden_trabajo.findMany({
    where: {
      estado: {
        not: "anulada",
      },
    },
    orderBy: {
      fecha_registro: "desc",
    },
    take: 50,
    include: {
      producto: true,
      cliente: true,
    },
  });
}

export type WorkOrderListFilters = {
  q: string;
  product: string;
  client: string;
  campaign: string;
  type: string;
  status: string;
  priority: string;
  fromDate: Date | null;
  toDate: Date | null;
};

function buildWorkOrderListWhere({
  q,
  product,
  client,
  campaign,
  type,
  status,
  priority,
  fromDate,
  toDate,
}: WorkOrderListFilters): Prisma.orden_trabajoWhereInput {
  const filters: Prisma.orden_trabajoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_orden_trabajo: {
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
        {
          cliente: {
            nombre_razon_social: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          detalle_pedido: {
            pedido: {
              cliente: {
                nombre_razon_social: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ],
    });
  }

  if (product) {
    filters.push({
      id_producto: product,
    });
  }

  if (client) {
    filters.push({
      OR: [
        {
          id_cliente: client,
        },
        {
          detalle_pedido: {
            pedido: {
              id_cliente: client,
            },
          },
        },
      ],
    });
  }

  if (campaign) {
    filters.push({
      id_campania: campaign,
    });
  }

  if (type) {
    filters.push({
      tipo_produccion: type,
    });
  }

  if (status) {
    filters.push({
      estado: status,
    });
  }

  if (priority) {
    filters.push({
      prioridad: priority,
    });
  }

  if (fromDate || toDate) {
    filters.push({
      fecha_inicio: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    });
  }

  const where: Prisma.orden_trabajoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  return where;
}

// Ordenes de la pagina con sus totales por estado y las opciones de los
// filtros. Los totales usan el mismo filtro que el listado.
export async function getWorkOrderListData(
  filters: WorkOrderListFilters,
  { skip, take }: { skip: number; take: number },
) {
  const where = buildWorkOrderListWhere(filters);

  const [
    workOrders,
    totalItems,
    totalActive,
    totalPending,
    totalFinished,
    products,
    clients,
    campaigns,
  ] = await Promise.all([
    prisma.orden_trabajo.findMany({
      where,
      skip,
      take,
      include: {
        producto: true,
        cliente: true,
        campania_produccion: true,
        ruta_fabricacion: true,
        version_receta: {
          include: {
            receta_tecnica: true,
          },
        },
        detalle_pedido: {
          include: {
            pedido: {
              include: {
                cliente: true,
              },
            },
          },
        },
        _count: {
          select: {
            avance_orden: true,
            movimiento_inventario: true,
          },
        },
      },
      orderBy: [
        {
          fecha_registro: "desc",
        },
        {
          id_orden_trabajo: "desc",
        },
      ],
    }),
    prisma.orden_trabajo.count({ where }),
    prisma.orden_trabajo.count({
      where: {
        AND: [where, { estado: { in: ["pendiente", "en_proceso", "pausada"] } }],
      },
    }),
    prisma.orden_trabajo.count({
      where: { AND: [where, { estado: "pendiente" }] },
    }),
    prisma.orden_trabajo.count({
      where: { AND: [where, { estado: "finalizada" }] },
    }),
    findActiveProductFilterOptions(),
    prisma.cliente.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_razon_social: "asc",
      },
      select: {
        id_cliente: true,
        nombre_razon_social: true,
      },
    }),
    prisma.campania_produccion.findMany({
      where: {
        estado: {
          in: ["planificada", "activa"],
        },
      },
      orderBy: {
        nombre_campania: "asc",
      },
      select: {
        id_campania: true,
        nombre_campania: true,
      },
    }),
  ]);

  return {
    workOrders,
    totalItems,
    totalActive,
    totalPending,
    totalFinished,
    products,
    clients,
    campaigns,
  };
}

// Opciones del formulario de nueva orden. La pagina las reduce a lo que
// recibe el formulario cliente.
export async function getNewWorkOrderFormData() {
  const [products, routes, versions, orderDetails, campaigns] =
    await Promise.all([
      findActiveProductsByCategory(),

      prisma.ruta_fabricacion.findMany({
        where: {
          estado: true,
        },
        include: {
          producto: true,
          _count: {
            select: {
              etapa_ruta: true,
            },
          },
        },
        orderBy: [
          {
            nombre_ruta: "asc",
          },
        ],
      }),

      prisma.version_receta.findMany({
        where: {
          estado: "vigente",
          receta_tecnica: {
            estado: "activa",
          },
        },
        include: {
          receta_tecnica: {
            include: {
              producto: true,
            },
          },
          _count: {
            select: {
              detalle_receta: true,
            },
          },
        },
        orderBy: [
          {
            fecha_version: "desc",
          },
        ],
      }),

      prisma.detalle_pedido.findMany({
        where: {
          pedido: {
            estado: {
              in: ["registrado", "aprobado"],
            },
          },
        },
        include: {
          producto: true,
          pedido: {
            include: {
              cliente: true,
            },
          },
        },
        orderBy: [
          {
            pedido: {
              fecha_pedido: "desc",
            },
          },
        ],
      }),

      prisma.campania_produccion.findMany({
        where: {
          estado: {
            in: ["planificada", "activa"],
          },
        },
        include: {
          campania_detalle: {
            select: {
              id_producto: true,
            },
          },
        },
        orderBy: [
          {
            fecha_inicio: "desc",
          },
        ],
      }),
    ]);

  return { products, routes, versions, orderDetails, campaigns };
}

// La orden con todo lo que muestra su detalle: ruta, receta, origen,
// avances, movimientos y requerimiento congelado.
export async function getWorkOrderDetail(idOrdenTrabajo: string) {
  return prisma.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: idOrdenTrabajo,
    },
    include: {
      producto: true,
      cliente: true,
      usuario: {
        select: {
          nombres: true,
          apellidos: true,
        },
      },
      campania_produccion: true,
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
      detalle_pedido: {
        include: {
          pedido: {
            include: {
              cliente: true,
            },
          },
        },
      },
      avance_orden: true,
      movimiento_inventario: true,
      requerimiento_orden_material: {
        include: {
          material: true,
        },
        orderBy: {
          id_requerimiento: "asc",
        },
      },
    },
  });
}
