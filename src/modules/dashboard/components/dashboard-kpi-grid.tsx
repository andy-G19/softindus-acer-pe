import {
  AlertTriangle,
  ClipboardList,
  Landmark,
  ShoppingCart,
  TrendingUp,
  Truck,
  WalletCards,
  Wrench,
} from "lucide-react";

import { KpiCard } from "@/components/ui/kpi-card";
import { formatMoney } from "@/lib/formatters";
import type { DashboardData } from "@/modules/dashboard/data";

type DashboardKpiGridProps = {
  dashboardData: DashboardData;
};

export function DashboardKpiGrid({ dashboardData }: DashboardKpiGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {dashboardData.canSeeProduction ? (
        <KpiCard
          title="Órdenes activas"
          value={dashboardData.activeWorkOrders.toString()}
          description="Pendientes, en proceso o pausadas."
          href="/dashboard/production/work-orders"
          tone="info"
          icon={ClipboardList}
        />
      ) : null}

      {dashboardData.canSeeCommercial ? (
        <KpiCard
          title="Pedidos pendientes"
          value={dashboardData.pendingOrders.toString()}
          description="Registrados, aprobados o en producción."
          href="/dashboard/commercial/orders"
          tone="warning"
          icon={ShoppingCart}
        />
      ) : null}

      {dashboardData.canSeeInventory ? (
        <KpiCard
          title="Stock crítico"
          value={dashboardData.criticalMaterials.length.toString()}
          description="Materiales activos bajo mínimo."
          href="/dashboard/inventory/materials"
          tone="success"
          icon={AlertTriangle}
        />
      ) : null}

      {dashboardData.canSeeCommercial ? (
        <KpiCard
          title="Cuentas por cobrar"
          value={formatMoney(dashboardData.receivables)}
          description="Saldo vigente o aceptado pendiente."
          href="/dashboard/commercial/quotes"
          tone="warning"
          icon={Landmark}
        />
      ) : null}

      {dashboardData.canSeePettyCash ? (
        <KpiCard
          title="Saldo de caja chica"
          value={formatMoney(dashboardData.pettyCashBalance)}
          description="Suma de cajas abiertas."
          href="/dashboard/petty-cash"
          tone="info"
          icon={WalletCards}
        />
      ) : null}

      {dashboardData.canSeeCosts ? (
        <KpiCard
          title="Utilidad estimada"
          value={formatMoney(dashboardData.estimatedProfit)}
          description="Suma registrada en rentabilidad."
          href="/dashboard/costs"
          tone="info"
          icon={TrendingUp}
        />
      ) : null}

      {dashboardData.canSeePurchases ? (
        <KpiCard
          title="Compras pendientes"
          value={dashboardData.pendingPurchases.toString()}
          description="Compras con pago pendiente o parcial."
          href="/dashboard/inventory/purchases"
          tone="warning"
          icon={Truck}
        />
      ) : null}

      {dashboardData.canSeeMaintenance ? (
        <KpiCard
          title="Fallas activas"
          value={dashboardData.activeFailures.toString()}
          description="Fallas sin cierre operativo."
          href="/dashboard/maintenance/failures"
          tone="success"
          icon={Wrench}
        />
      ) : null}
    </div>
  );
}
