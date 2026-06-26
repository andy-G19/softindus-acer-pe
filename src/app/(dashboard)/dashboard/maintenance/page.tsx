import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function formatHours(value: unknown) {
  return `${toNumber(value).toFixed(2)} h`;
}

type MaintenanceSection = {
  title: string;
  description: string;
  phase: string;
  access: string;
  href?: string;
};

export default async function MaintenanceDashboardPage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const today = new Date();

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const startOfNextMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1,
  );

  const [
    totalMachines,
    operationalMachines,
    openFailures,
    failuresThisMonth,
    pendingPreventiveMaintenance,
    overduePreventiveMaintenance,
    maintenanceCostsThisMonth,
    latestFailures,
    upcomingPreventiveMaintenance,
  ] = await Promise.all([
    prisma.maquina.count(),

    prisma.maquina.count({
      where: {
        estado: "operativa",
      },
    }),

    prisma.falla_maquina.count({
      where: {
        estado_atencion: {
          in: ["pendiente", "en_atencion"],
        },
      },
    }),

    prisma.falla_maquina.count({
      where: {
        fecha_falla: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.mantenimiento_preventivo.count({
      where: {
        estado: "pendiente",
      },
    }),

    prisma.mantenimiento_preventivo.count({
      where: {
        estado: "pendiente",
        fecha_programada: {
          lt: startOfToday,
        },
      },
    }),

    prisma.reparacion.aggregate({
      where: {
        fecha_reparacion: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        costo_total: true,
      },
    }),

    prisma.falla_maquina.findMany({
      orderBy: {
        fecha_falla: "desc",
      },
      take: 6,
      include: {
        maquina: true,
      },
    }),

    prisma.mantenimiento_preventivo.findMany({
      orderBy: {
        fecha_programada: "asc",
      },
      take: 6,
      include: {
        maquina: true,
      },
    }),
  ]);

  const inactiveMachines = totalMachines - operationalMachines;

  const sections: MaintenanceSection[] = [
    {
      title: "Máquinas",
      description:
        "Registro y consulta de máquinas o equipos críticos del taller.",
      phase: "Subfase 9.2",
      access: "ADMIN",
      href: "/dashboard/maintenance/machines",
    },
    {
      title: "Fallas",
      description:
        "Registro de fallas, paradas, responsable e impacto productivo.",
      phase: "Subfase 9.3",
      access: "ADMIN / Maestro de taller",
      href: "/dashboard/maintenance/failures",
    },
    {
      title: "Repuestos",
      description:
        "Registro de repuestos utilizados en reparaciones de maquinaria.",
      phase: "Subfase 9.4",
      access: "ADMIN",
      href: "/dashboard/maintenance/spare-parts",
    },
    {
      title: "Reparaciones",
      description:
        "Registro de técnico, mano de obra, costo total y repuestos usados.",
      phase: "Subfase 9.5",
      access: "ADMIN",
      href: "/dashboard/maintenance/repairs",
    },
    {
      title: "Preventivos",
      description:
        "Programación y seguimiento de mantenimientos preventivos básicos.",
      phase: "Subfase 9.6",
      access: "ADMIN",
      href: "/dashboard/maintenance/preventive",
    },
    {
      title: "Reincidencias",
      description:
        "Consulta de máquinas con más fallas, tiempos perdidos y costos.",
      phase: "Subfase 9.7",
      access: "ADMIN",
      href: "/dashboard/maintenance/recurrences",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">Fase 9</p>
        <h1 className="text-3xl font-bold tracking-tight">
          Mantenimiento de maquinaria
        </h1>
        <p className="mt-2 text-muted-foreground">
          Control de máquinas, fallas, reparaciones, repuestos, costos,
          reincidencias y mantenimientos preventivos del taller.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Máquinas registradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalMachines}</p>
            <p className="text-xs text-muted-foreground">
              Total de equipos críticos registrados.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Máquinas operativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{operationalMachines}</p>
            <p className="text-xs text-muted-foreground">
              No operativas o inactivas: {inactiveMachines}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Fallas abiertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openFailures}</p>
            <p className="text-xs text-muted-foreground">
              Fallas registradas este mes: {failuresThisMonth}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Preventivos pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {pendingPreventiveMaintenance}
            </p>
            <p className="text-xs text-muted-foreground">
              Vencidos: {overduePreventiveMaintenance}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Costos de mantenimiento del mes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            {formatMoney(maintenanceCostsThisMonth._sum.costo_total)}
          </p>
          <p className="text-sm text-muted-foreground">
            Suma de reparaciones registradas durante el mes actual.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const content = (
            <Card className="h-full transition hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {section.phase} · Acceso: {section.access}
                </p>
              </CardContent>
            </Card>
          );
      
          if (section.href) {
            return (
              <Link key={section.title} href={section.href}>
                {content}
              </Link>
            );
          }
      
          return <div key={section.title}>{content}</div>;
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Últimas fallas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            {latestFailures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay fallas registradas.
              </p>
            ) : (
              <div className="space-y-3">
                {latestFailures.map((failure) => (
                  <div key={failure.id_falla} className="rounded-lg border p-3">
                    <p className="font-medium">{failure.maquina.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      Fecha: {formatDate(failure.fecha_falla)} · Estado:{" "}
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
              <p className="text-sm text-muted-foreground">
                Todavía no hay mantenimientos preventivos programados.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingPreventiveMaintenance.map((maintenance) => (
                  <div
                    key={maintenance.id_mantenimiento}
                    className="rounded-lg border p-3"
                  >
                    <p className="font-medium">{maintenance.maquina.nombre}</p>
                    <p className="text-sm text-muted-foreground">
                      Fecha programada:{" "}
                      {formatDate(maintenance.fecha_programada)} · Estado:{" "}
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