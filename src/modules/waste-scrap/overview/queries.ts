import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura del panel de Mermas y chatarra. No autorizan: la pagina
// que las llama ya verifico el rol con requireRole.

export async function getWasteScrapOverviewData() {
  const [
    totalRetazos,
    retazosDisponibles,
    retazosReutilizados,
    retazosDescartados,
    totalChatarra,
    chatarraAcumulada,
    chatarraVendida,
    ventasChatarra,
    ingresosChatarra,
    latestRetazos,
    pendingScraps,
    latestSales,
  ] = await Promise.all([
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

    prisma.chatarra.count(),

    prisma.chatarra.count({
      where: {
        estado: {
          in: ["acumulada", "disponible"],
        },
      },
    }),

    prisma.chatarra.count({
      where: {
        estado: "vendida",
      },
    }),

    prisma.venta_chatarra.count(),

    prisma.venta_chatarra.aggregate({
      _sum: {
        monto_recibido: true,
        peso_vendido_kg: true,
        cantidad_vendida: true,
      },
    }),

    prisma.retazo_reutilizable.findMany({
      orderBy: {
        fecha_registro: "desc",
      },
      take: 5,
      include: {
        material: true,
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
      },
    }),

    prisma.chatarra.findMany({
      where: {
        estado: {
          in: ["acumulada", "disponible"],
        },
      },
      orderBy: {
        fecha_registro: "desc",
      },
      take: 5,
      include: {
        material: true,
      },
    }),

    prisma.venta_chatarra.findMany({
      orderBy: {
        fecha_venta: "desc",
      },
      take: 5,
      include: {
        chatarra: {
          include: {
            material: true,
          },
        },
        movimiento_caja: true,
      },
    }),
  ]);

  return {
    totalRetazos,
    retazosDisponibles,
    retazosReutilizados,
    retazosDescartados,
    totalChatarra,
    chatarraAcumulada,
    chatarraVendida,
    ventasChatarra,
    ingresosChatarra,
    latestRetazos,
    pendingScraps,
    latestSales,
  };
}
