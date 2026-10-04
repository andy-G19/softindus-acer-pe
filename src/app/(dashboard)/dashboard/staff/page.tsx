/**
 * Ubicación destino: src/app/(dashboard)/dashboard/staff/page.tsx
 * (reemplaza el archivo actual)
 */
import {
  CalendarCheck,
  FileSpreadsheet,
  ListChecks,
  Receipt,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ModuleAccessCard } from "@/components/ui/module-access-card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { getStaffOverviewData } from "@/modules/staff/overview/queries";
import { formatDate } from "@/lib/formatters";
import { dashboardBreadcrumbs } from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";

function getOperatorStatusVariant(status: string) {
  if (status === "activo") {
    return "success" as const;
  }

  return "secondary" as const;
}

function formatHours(value: unknown) {
  return `${toNumber(value).toFixed(2)} h`;
}

export default async function StaffDashboardPage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const today = new Date();

  const {
    totalOperators,
    activeOperators,
    inactiveOperators,
    attendanceToday,
    absencesToday,
    tasksThisMonth,
    pendingPayrolls,
    latestOperators,
    latestAttendance,
  } = await getStaffOverviewData(today);

  const quickLinks = [
    {
      title: "Operarios",
      description: "Registrar y consultar trabajadores del taller.",
      href: "/dashboard/staff/operators",
      roles: "ADMIN",
      icon: UserRoundCheck,
      tone: "chart-1" as const,
    },
    {
      title: "Asistencia diaria",
      description: "Registrar ingreso, salida, tardanza o falta.",
      href: "/dashboard/staff/attendance",
      roles: "ADMIN",
      icon: CalendarCheck,
      tone: "chart-2" as const,
    },
    {
      title: "Tareas diarias",
      description: "Registrar actividades realizadas por operario.",
      href: "/dashboard/staff/tasks",
      roles: "ADMIN / Maestro de taller",
      icon: ListChecks,
      tone: "chart-3" as const,
    },
    {
      title: "Planillas",
      description: "Generar pagos según asistencia y modalidad.",
      href: "/dashboard/staff/payrolls",
      roles: "ADMIN",
      icon: FileSpreadsheet,
      tone: "chart-4" as const,
    },
    {
      title: "Historial de pagos",
      description: "Consultar pagos realizados a operarios.",
      href: "/dashboard/staff/payment-history",
      roles: "ADMIN",
      icon: Receipt,
      tone: "chart-5" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal"
        description="Control de operarios, asistencia diaria, tareas realizadas, modalidades de pago, planillas e historial de pagos."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Personal" }])}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Operarios registrados"
          value={totalOperators.toString()}
          description="Total de trabajadores registrados."
          tone="info"
          icon={Users}
        />
        <KpiCard
          title="Operarios activos"
          value={activeOperators.toString()}
          description={`Inactivos o retirados: ${inactiveOperators}`}
          tone="success"
          icon={UserRoundCheck}
        />
        <KpiCard
          title="Asistencias de hoy"
          value={attendanceToday.toString()}
          description={`Faltas registradas hoy: ${absencesToday}`}
          tone={absencesToday > 0 ? "warning" : "info"}
          icon={CalendarCheck}
        />
        <KpiCard
          title="Planillas pendientes"
          value={pendingPayrolls.toString()}
          description={`Tareas registradas este mes: ${tasksThisMonth}`}
          tone={pendingPayrolls > 0 ? "warning" : "info"}
          icon={FileSpreadsheet}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map((link, i) => (
          <ModuleAccessCard
            key={link.href}
            index={i + 1}
            tone={link.tone}
            icon={link.icon}
            title={link.title}
            description={`${link.description} Acceso: ${link.roles}.`}
            href={link.href}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimos operarios registrados</CardTitle>
          </CardHeader>
          <CardContent>
            {latestOperators.length === 0 ? (
              <EmptyState label="Todavía no hay operarios registrados." />
            ) : (
              <div className="space-y-3">
                {latestOperators.map((operator) => (
                  <div
                    key={operator.id_operario}
                    className="rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {operator.apellidos}, {operator.nombres}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Cargo: {operator.cargo ?? "-"} | Modalidad:{" "}
                          {operator.modalidad_pago}
                        </p>
                      </div>
                      <Badge variant={getOperatorStatusVariant(operator.estado)}>
                        {operator.estado}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas asistencias</CardTitle>
          </CardHeader>
          <CardContent>
            {latestAttendance.length === 0 ? (
              <EmptyState label="Todavía no hay asistencias registradas." />
            ) : (
              <div className="space-y-3">
                {latestAttendance.map((attendance) => (
                  <div
                    key={attendance.id_asistencia}
                    className="rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">
                          {attendance.operario.apellidos},{" "}
                          {attendance.operario.nombres}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Fecha: {formatDate(attendance.fecha, { format: "dd/mm/yyyy" })} | Horas:{" "}
                          {formatHours(attendance.horas_trabajadas)}
                        </p>
                      </div>
                      {attendance.falta ? (
                        <Badge variant="destructive">Falta</Badge>
                      ) : attendance.tardanza ? (
                        <Badge variant="warning">Tardanza</Badge>
                      ) : (
                        <Badge variant="success">Puntual</Badge>
                      )}
                    </div>
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
