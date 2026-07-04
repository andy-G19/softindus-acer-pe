import { prisma } from "@/lib/db";

import {
  ACTIVE_WORK_ORDER_STATUSES,
  CLOSED_FAILURE_STATUSES,
  PENDING_ORDER_STATUSES,
  PENDING_PURCHASE_PAYMENT_STATUSES,
  RECEIVABLE_QUOTE_STATUSES,
} from "./constants";
import { toNumber } from "./utils";

export async function getDashboardData(role: string) {
  const canSeeCommercial = ["ADMIN", "SELLER"].includes(role);
  const canSeeInventory = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canSeeProduction = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canSeeMaintenance = ["ADMIN", "WORKSHOP_MASTER"].includes(role);
  const canSeeCosts = role === "ADMIN";
  const canSeePettyCash = role === "ADMIN";
  const canSeePurchases = role === "ADMIN";

  const [
    activeWorkOrders,
    latestWorkOrders,
    pendingOrders,
    latestOrders,
    criticalMaterials,
    receivables,
    pettyCashBalance,
    estimatedProfit,
    pendingPurchases,
    activeFailures,
    latestCashMovements,
  ] = await Promise.all([
    canSeeProduction
      ? prisma.orden_trabajo.count({
          where: {
            estado: {
              in: ACTIVE_WORK_ORDER_STATUSES,
            },
          },
        })
      : Promise.resolve(0),
    canSeeProduction
      ? prisma.orden_trabajo.findMany({
          orderBy: {
            fecha_registro: "desc",
          },
          take: 5,
          select: {
            id_orden_trabajo: true,
            estado: true,
            prioridad: true,
            fecha_inicio: true,
            producto: {
              select: {
                nombre_producto: true,
              },
            },
            cliente: {
              select: {
                nombre_razon_social: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canSeeCommercial
      ? prisma.pedido.count({
          where: {
            estado: {
              in: PENDING_ORDER_STATUSES,
            },
          },
        })
      : Promise.resolve(0),
    canSeeCommercial
      ? prisma.pedido.findMany({
          orderBy: {
            fecha_pedido: "desc",
          },
          take: 5,
          select: {
            id_pedido: true,
            estado: true,
            fecha_pedido: true,
            monto_estimado: true,
            cliente: {
              select: {
                nombre_razon_social: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    canSeeInventory
      ? prisma.material
          .findMany({
            where: {
              estado: true,
            },
            orderBy: {
              nombre_material: "asc",
            },
            select: {
              id_material: true,
              nombre_material: true,
              unidad_medida: true,
              stock_actual: true,
              stock_minimo: true,
            },
          })
          .then((materials) => {
            return materials.filter((material) => {
              return (
                toNumber(material.stock_actual) <= toNumber(material.stock_minimo)
              );
            });
          })
      : Promise.resolve([]),
    canSeeCommercial
      ? prisma.proforma.aggregate({
          where: {
            saldo: {
              gt: 0,
            },
            estado: {
              in: RECEIVABLE_QUOTE_STATUSES,
            },
          },
          _sum: {
            saldo: true,
          },
        })
      : Promise.resolve(null),
    canSeePettyCash
      ? prisma.caja_chica.aggregate({
          where: {
            estado: "abierta",
          },
          _sum: {
            saldo_actual: true,
          },
        })
      : Promise.resolve(null),
    canSeeCosts
      ? prisma.rentabilidad.aggregate({
          _sum: {
            utilidad_estimada: true,
          },
        })
      : Promise.resolve(null),
    canSeePurchases
      ? prisma.compra.count({
          where: {
            estado_pago: {
              in: PENDING_PURCHASE_PAYMENT_STATUSES,
            },
          },
        })
      : Promise.resolve(0),
    canSeeMaintenance
      ? prisma.falla_maquina.count({
          where: {
            estado_atencion: {
              notIn: CLOSED_FAILURE_STATUSES,
            },
          },
        })
      : Promise.resolve(0),
    canSeePettyCash
      ? prisma.movimiento_caja.findMany({
          orderBy: [
            {
              fecha_movimiento: "desc",
            },
            {
              id_movimiento_caja: "desc",
            },
          ],
          take: 5,
          select: {
            id_movimiento_caja: true,
            tipo_movimiento: true,
            concepto: true,
            monto: true,
            fecha_movimiento: true,
            caja_chica: {
              select: {
                nombre_caja: true,
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  return {
    activeWorkOrders,
    latestWorkOrders,
    pendingOrders,
    latestOrders,
    criticalMaterials,
    receivables: toNumber(receivables?._sum.saldo),
    pettyCashBalance: toNumber(pettyCashBalance?._sum.saldo_actual),
    estimatedProfit: toNumber(estimatedProfit?._sum.utilidad_estimada),
    pendingPurchases,
    activeFailures,
    latestCashMovements,
    canSeeCommercial,
    canSeeInventory,
    canSeeProduction,
    canSeeMaintenance,
    canSeeCosts,
    canSeePettyCash,
    canSeePurchases,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
