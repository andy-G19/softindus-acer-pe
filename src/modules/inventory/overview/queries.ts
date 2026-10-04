import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura del panel de Inventario. No autorizan: la pagina que
// las llama ya verifico el rol con requireRole.

export async function getInventoryOverviewData() {
  const [materialsCount, suppliersCount, activeAlertsCount, movementsCount] =
    await Promise.all([
      prisma.material.count({
        where: {
          estado: true,
        },
      }),
      prisma.proveedor.count({
        where: {
          estado: true,
        },
      }),
      prisma.alerta_stock.count({
        where: {
          estado_alerta: "activa",
        },
      }),
      prisma.movimiento_inventario.count(),
    ]);

  return { materialsCount, suppliersCount, activeAlertsCount, movementsCount };
}
