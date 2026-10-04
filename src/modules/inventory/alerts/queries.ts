import "server-only";

import { prisma } from "@/lib/db";

// Consultas de lectura de la pagina de Alertas de stock. No autorizan: la
// pagina que las llama ya verifico el rol con requireRole.

export async function getStockAlertsData() {
  const [materials, alerts] = await Promise.all([
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
    }),
    prisma.alerta_stock.findMany({
      orderBy: {
        fecha_alerta: "desc",
      },
    }),
  ]);

  const materialIds = [...new Set(alerts.map((alert) => alert.id_material))];

  const alertMaterials = await prisma.material.findMany({
    where: {
      id_material: {
        in: materialIds,
      },
    },
  });

  return { materials, alerts, alertMaterials };
}
