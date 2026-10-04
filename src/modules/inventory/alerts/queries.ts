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
      select: {
        id_material: true,
        nombre_material: true,
        categoria: true,
        unidad_medida: true,
        stock_actual: true,
        stock_reservado: true,
        stock_minimo: true,
      },
    }),
    prisma.alerta_stock.findMany({
      orderBy: {
        fecha_alerta: "desc",
      },
      select: {
        id_alerta: true,
        id_material: true,
        fecha_alerta: true,
        estado_alerta: true,
        mensaje: true,
        stock_detectado: true,
        stock_minimo: true,
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
    select: {
      id_material: true,
      nombre_material: true,
      categoria: true,
      unidad_medida: true,
      stock_actual: true,
      stock_reservado: true,
      stock_minimo: true,
    },
  });

  return { materials, alerts, alertMaterials };
}
