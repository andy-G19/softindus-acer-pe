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
        />
      ) : null}

      {dashboardData.canSeeCommercial ? (
        <KpiCard
          title="Pedidos pendientes"
          value={dashboardData.pendingOrders.toString()}
          description="Registrados, aprobados o en producción."
          href="/dashboard/commercial/orders"
          tone="warning"
        />
      ) : null}

      {dashboardData.canSeeInventory ? (
        <KpiCard
          title="Stock crítico"
          value={dashboardData.criticalMaterials.length.toString()}
          description="Materiales activos bajo mínimo."
          href="/dashboard/inventory/materials"
          tone="success"
        />
      ) : null}

      {dashboardData.canSeeCommercial ? (
        <KpiCard
          title="Cuentas por cobrar"
          value={formatMoney(dashboardData.receivables)}
          description="Saldo vigente o aceptado pendiente."
          href="/dashboard/commercial/quotes"
          tone="warning"
        />
      ) : null}

      {dashboardData.canSeePettyCash ? (
        <KpiCard
          title="Saldo de caja chica"
          value={formatMoney(dashboardData.pettyCashBalance)}
          description="Suma de cajas abiertas."
          href="/dashboard/petty-cash"
          tone="info"
        />
      ) : null}

      {dashboardData.canSeeCosts ? (
        <KpiCard
          title="Utilidad estimada"
          value={formatMoney(dashboardData.estimatedProfit)}
          description="Suma registrada en rentabilidad."
          href="/dashboard/costs"
          tone="info"
        />
      ) : null}

      {dashboardData.canSeePurchases ? (
        <KpiCard
          title="Compras pendientes"
          value={dashboardData.pendingPurchases.toString()}
          description="Compras con pago pendiente o parcial."
          href="/dashboard/inventory/purchases"
          tone="warning"
        />
      ) : null}

      {dashboardData.canSeeMaintenance ? (
        <KpiCard
          title="Fallas activas"
          value={dashboardData.activeFailures.toString()}
          description="Fallas sin cierre operativo."
          href="/dashboard/maintenance/failures"
          tone="success"
        />
      ) : null}
    </div>
  );
}
