import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { cancelOperatorTaskAction } from "@/modules/staff/tasks/actions";

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

function formatHours(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${toNumber(value).toFixed(2)} h`;
}

function getTaskStatusLabel(status: string) {
  const labels: Record<string, string> = {
    registrada: "Registrada",
    en_proceso: "En proceso",
    terminada: "Terminada",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

function getTaskBadgeVariant(status: string) {
  if (status === "anulada") {
    return "destructive" as const;
  }

  if (status === "terminada") {
    return "success" as const;
  }

  return "secondary" as const;
}

export default async function OperatorTasksPage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const today = new Date();

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const startOfTomorrow = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1,
  );

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const startOfNextMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1,
  );

  const [
    totalTasks,
    tasksToday,
    tasksThisMonth,
    finishedTasks,
    latestTasks,
  ] = await Promise.all([
    prisma.tarea_operario.count(),

    prisma.tarea_operario.count({
      where: {
        fecha_tarea: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
      },
    }),

    prisma.tarea_operario.count({
      where: {
        fecha_tarea: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.tarea_operario.count({
      where: {
        estado: "terminada",
      },
    }),

    prisma.tarea_operario.findMany({
      orderBy: [
        {
          fecha_tarea: "desc",
        },
        {
          id_tarea_operario: "desc",
        },
      ],
      take: 50,
      include: {
        operario: true,
        etapa_ruta: true,
        usuario: true,
        orden_trabajo: {
          include: {
            producto: true,
            cliente: true,
          },
        },
      },
    }),
  ]);

  const activeTasks = latestTasks.filter((task) => task.estado !== "anulada");

  const totalHours = activeTasks.reduce((total, task) => {
    return total + toNumber(task.horas_dedicadas);
  }, 0);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Tareas diarias por operario"
        description="Registra y consulta qué actividad realizó cada operario, asociándola con una orden de trabajo, etapa productiva, fecha, horas dedicadas y responsable del registro."
        backHref={navigationHrefs.staff}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Tareas diarias" },
        ])}
        actions={
          <Button asChild>
            <Link href="/dashboard/staff/tasks/new">Registrar tarea</Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Tareas registradas" value={totalTasks.toString()} description="Historial general de tareas." tone="info" />
        <KpiCard title="Tareas de hoy" value={tasksToday.toString()} description="Actividades registradas para la fecha actual." tone="info" />
        <KpiCard title="Tareas del mes" value={tasksThisMonth.toString()} description="Registros del periodo actual." tone="info" />
        <KpiCard title="Horas registradas" value={formatHours(totalHours)} description={`Terminadas históricas: ${finishedTasks}`} tone="success" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimas tareas registradas
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {latestTasks.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="Todavía no hay tareas registradas."
              description="Registra la primera tarea diaria para conocer qué actividad realizó cada operario."
              action={
                <Button asChild>
                  <Link href="/dashboard/staff/tasks/new">
                    Registrar primera tarea
                  </Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Operario</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  <TableHead>Registrado por</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {latestTasks.map((task) => (
                  <TableRow key={task.id_tarea_operario}>
                    <TableCell className="font-mono text-xs">
                      {task.id_tarea_operario}
                    </TableCell>

                    <TableCell>{formatDate(task.fecha_tarea)}</TableCell>

                    <TableCell className="font-medium">
                      {task.operario.apellidos}, {task.operario.nombres}
                    </TableCell>

                    <TableCell className="font-mono text-xs">
                      {task.id_orden_trabajo}
                    </TableCell>

                    <TableCell>
                      {task.orden_trabajo.producto.nombre_producto}
                    </TableCell>

                    <TableCell>{task.etapa_ruta?.nombre_etapa ?? "-"}</TableCell>

                    <TableCell>
                      {task.descripcion}
                      {task.observaciones ? (
                        <p className="text-xs text-muted-foreground">
                          {task.observaciones}
                        </p>
                      ) : null}
                    </TableCell>

                    <TableCell className="text-right">
                      {formatHours(task.horas_dedicadas)}
                    </TableCell>

                    <TableCell className="text-right">
                      <Badge variant={getTaskBadgeVariant(task.estado)}>
                        {getTaskStatusLabel(task.estado)}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      {task.usuario.nombres} {task.usuario.apellidos}
                    </TableCell>

                    <TableCell className="text-right">
                      {task.estado === "anulada" ? (
                        <span className="text-xs text-muted-foreground">
                          Sin acción
                        </span>
                      ) : (
                        <form action={cancelOperatorTaskAction}>
                          <input
                            type="hidden"
                            name="id_tarea_operario"
                            value={task.id_tarea_operario}
                          />

                          <Button type="submit" variant="outline" size="sm">
                            Anular
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}