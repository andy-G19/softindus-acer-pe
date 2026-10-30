/**
 * Ubicación destino: src/app/(dashboard)/dashboard/maintenance/page.tsx
 * (reemplaza el archivo actual)
 */
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Cog,
  Hammer,
  RefreshCcw,
  Wrench,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  ModuleAccessCard,
  type ModuleCardTone,
} from "@/components/ui/module-access-card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { getMaintenanceOverviewData } from "@/modules/maintenance/overview/queries";
import { formatDate, formatMoney } from "@/lib/formatters";
import { dashboardBreadcrumbs } from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES, type AppRole } from "@/lib/permissions";

function formatHours(value: unknown) {
  return `${toNumber(value).toFixed(2)} h`;
}

type MaintenanceSection = {
  title: string;
  description: string;
  phase: string;
  access: string;
  href?: string;
  /** Los roles que admite el requireRole de la pantalla de destino. */
  roles: readonly AppRole[];
  icon: LucideIcon;
  tone: ModuleCardTone;
};

const ADMIN_ONLY = [APP_ROLES.ADMIN] as const;
const ADMIN_AND_WORKSHOP = [APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER] as const;

export default async function MaintenanceDashboardPage() {
  const session = await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const today = new Date();

  const {
    totalMachines,
    operationalMachines,
    openFailures,
    failuresThisMonth,
    pendingPreventiveMaintenance,
    overduePreventiveMaintenance,
    maintenanceCostsThisMonth,
    latestFailures,
    upcomingPreventiveMaintenance,
  } = await getMaintenanceOverviewData(today);

  const inactiveMachines = totalMachines - operationalMachines;

  // Cada tarjeta lleva los roles que admite su pantalla (los de su
  // requireRole) y solo se muestra a ellos (entrega 10.5a), como en
  // Inventario: el maestro de taller veia tarjetas que lo llevaban a «acceso
  // denegado». maintenance-links.test.ts abre cada enlace con cada rol.
  const sections = ([
    {
      title: "Máquinas",
      description:
        "Registro y consulta de máquinas o equipos críticos del taller.",
      phase: "Subfase 9.2",
      access: "ADMIN",
      href: "/dashboard/maintenance/machines",
      roles: ADMIN_AND_WORKSHOP,
      icon: Wrench,
      tone: "chart-1",
    },
    {
      title: "Fallas",
      description:
        "Registro de fallas, paradas, responsable e impacto productivo.",
      phase: "Subfase 9.3",
      access: "ADMIN / Maestro de taller",
      href: "/dashboard/maintenance/failures",
      roles: ADMIN_AND_WORKSHOP,
      icon: AlertTriangle,
      tone: "chart-2",
    },
    {
      title: "Repuestos",
      description:
        "Registro de repuestos utilizados en reparaciones de maquinaria.",
      phase: "Subfase 9.4",
      access: "ADMIN",
      href: "/dashboard/maintenance/spare-parts",
      roles: ADMIN_ONLY,
      icon: Cog,
      tone: "chart-3",
    },
    {
      title: "Reparaciones",
      description:
        "Registro de técnico, mano de obra, costo total y repuestos usados.",
      phase: "Subfase 9.5",
      access: "ADMIN",
      href: "/dashboard/maintenance/repairs",
      roles: ADMIN_ONLY,
      icon: Hammer,
      tone: "chart-4",
    },
    {
      title: "Preventivos",
      description:
        "Programación y seguimiento de mantenimientos preventivos básicos.",
      phase: "Subfase 9.6",
      access: "ADMIN",
      href: "/dashboard/maintenance/preventive",
      roles: ADMIN_ONLY,
      icon: CalendarClock,
      tone: "chart-5",
    },
    {
      title: "Reincidencias",
      description:
        "Consulta de máquinas con más fallas, tiempos perdidos y costos.",
      phase: "Subfase 9.7",
      access: "ADMIN",
      href: "/dashboard/maintenance/recurrences",
      roles: ADMIN_ONLY,
      icon: RefreshCcw,
      tone: "chart-1",
    },
  ] satisfies MaintenanceSection[]).filter((section) =>
    section.roles.some((role) => role === session.user.role),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mantenimiento"
        description="Control de máquinas, fallas, reparaciones, repuestos, costos, reincidencias y mantenimientos preventivos del taller."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Mantenimiento" }])}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Máquinas registradas" value={totalMachines.toString()} description="Total de equipos críticos registrados." tone="info" icon={Wrench} />
        <KpiCard title="Máquinas operativas" value={operationalMachines.toString()} description={`No operativas o inactivas: ${inactiveMachines}`} tone="success" icon={CheckCircle2} />
        <KpiCard title="Fallas abiertas" value={openFailures.toString()} description={`Fallas registradas este mes: ${failuresThisMonth}`} tone={openFailures > 0 ? "warning" : "info"} icon={AlertTriangle} />
        <KpiCard title="Preventivos pendientes" value={pendingPreventiveMaintenance.toString()} description={`Vencidos: ${overduePreventiveMaintenance}`} tone={overduePreventiveMaintenance > 0 ? "warning" : "info"} icon={CalendarClock} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Costos de mantenimiento del mes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatMoney(maintenanceCostsThisMonth._sum.costo_total ?? 0)}
          </p>
          <p className="text-sm text-muted-foreground">
            Suma de reparaciones registradas durante el mes actual.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section, i) => (
          <ModuleAccessCard
            key={section.title}
            index={i + 1}
            tone={section.tone}
            icon={section.icon}
            title={section.title}
            description={`${section.description} Acceso: ${section.access}.`}
            href={section.href ?? "#"}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimas fallas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {latestFailures.length === 0 ? (
              <EmptyState label="Todavía no hay fallas registradas." />
            ) : (
              <div className="space-y-3">
                {latestFailures.map((failure) => (
                  <div
                    key={failure.id_falla}
                    className="rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <p className="font-medium text-foreground">{failure.maquina.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      Fecha: {formatDate(failure.fecha_falla, { format: "dd/mm/yyyy" })} | Estado:{" "}
                      {failure.estado_atencion}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tiempo perdido:{" "}
                      {formatHours(failure.tiempo_perdido_horas)}
                    </p>
                    <p className="mt-2 text-sm">{failure.descripcion}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos mantenimientos preventivos</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingPreventiveMaintenance.length === 0 ? (
              <EmptyState label="Todavía no hay mantenimientos preventivos programados." />
            ) : (
              <div className="space-y-3">
                {upcomingPreventiveMaintenance.map((maintenance) => (
                  <div
                    key={maintenance.id_mantenimiento}
                    className="rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <p className="font-medium text-foreground">{maintenance.maquina.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      Fecha programada:{" "}
                      {formatDate(maintenance.fecha_programada, { format: "dd/mm/yyyy" })} | Estado:{" "}
                      {maintenance.estado}
                    </p>
                    <p className="mt-2 text-sm">{maintenance.actividad}</p>
                    <p className="text-sm text-muted-foreground">
                      Responsable: {maintenance.responsable ?? "-"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
