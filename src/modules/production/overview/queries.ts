import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura del panel de Produccion. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole.

export async function getProductionOverviewData() {
  const [
    totalOrders,
    activeOrders,
    pendingOrders,
    inProcessOrders,
    pausedOrders,
    finishedOrders,
    activeProducts,
    activeRoutes,
    activeStages,
    activeRecipes,
    validVersions,
    recipeDetails,
    totalCampaigns,
    activeCampaigns,
  ] = await Promise.all([
    prisma.orden_trabajo.count(),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          in: ["pendiente", "en_proceso", "pausada"],
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "pendiente",
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "en_proceso",
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "pausada",
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "finalizada",
      },
    }),

    prisma.producto.count({
      where: {
        estado: true,
      },
    }),

    prisma.ruta_fabricacion.count({
      where: {
        estado: true,
      },
    }),

    prisma.etapa_ruta.count({
      where: {
        estado: true,
        ruta_fabricacion: {
          estado: true,
        },
      },
    }),

    prisma.receta_tecnica.count({
      where: {
        estado: "activa",
      },
    }),

    prisma.version_receta.count({
      where: {
        estado: "vigente",
        receta_tecnica: {
          estado: "activa",
        },
      },
    }),

    prisma.detalle_receta.count({
      where: {
        version_receta: {
          estado: "vigente",
          receta_tecnica: {
            estado: "activa",
          },
        },
      },
    }),

    prisma.campania_produccion.count(),

    prisma.campania_produccion.count({
      where: {
        estado: {
          in: ["planificada", "activa"],
        },
      },
    }),
  ]);

  return {
    totalOrders,
    activeOrders,
    pendingOrders,
    inProcessOrders,
    pausedOrders,
    finishedOrders,
    activeProducts,
    activeRoutes,
    activeStages,
    activeRecipes,
    validVersions,
    recipeDetails,
    totalCampaigns,
    activeCampaigns,
  };
}
