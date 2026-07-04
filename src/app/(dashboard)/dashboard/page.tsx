import { requireAuth } from "@/lib/authz";
import { getDashboardData } from "@/modules/dashboard/data";
import { DashboardKpiGrid } from "@/modules/dashboard/components/dashboard-kpi-grid";
import { DashboardModuleGrid } from "@/modules/dashboard/components/dashboard-module-grid";
import { DashboardRecentSummary } from "@/modules/dashboard/components/dashboard-recent-summary";
import { DashboardStatusCards } from "@/modules/dashboard/components/dashboard-status-cards";
import { SectionHeader } from "@/modules/dashboard/components/section-header";

export default async function DashboardPage() {
  const session = await requireAuth();

  const role = session.user.role;
  const dashboardData = await getDashboardData(role);

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Bienvenido al panel principal del sistema.
        </p>
      </div>

      <DashboardStatusCards session={session} />

      <section className="space-y-3">
        <SectionHeader
          title="Indicadores operativos"
          description="KPIs calculados desde PostgreSQL según los permisos del rol."
        />
        <DashboardKpiGrid dashboardData={dashboardData} />
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Resumen reciente"
          description="Movimientos y registros clave visibles para tu rol."
        />
        <DashboardRecentSummary dashboardData={dashboardData} />
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Módulos del sistema"
          description="Accede rápidamente a los módulos implementados del sistema."
        />
        <DashboardModuleGrid role={role} />
      </section>
    </div>
  );
}
