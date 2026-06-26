import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
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
    return "destructive";
  }

  if (status === "terminada") {
    return "default";
  }

  return "secondary";
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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Personal, asistencia y pagos · Tareas diarias
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Tareas diarias por operario
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registra y consulta qué actividad realizó cada operario,
            asociándola con una orden de trabajo, etapa productiva, fecha,
            horas dedicadas y responsable del registro.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/staff"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          <Link
            href="/dashboard/staff/tasks/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Registrar tarea
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tareas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalTasks}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Historial general de tareas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tareas de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tasksToday}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Actividades registradas para la fecha actual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tareas del mes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tasksThisMonth}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Registros del periodo actual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatHours(totalHours)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Terminadas históricas: {finishedTasks}
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Últimas tareas registradas
          </CardTitle>
        </CardHeader>

        <CardContent>
          {latestTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Todavía no hay tareas registradas.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Registra la primera tarea diaria para conocer qué actividad
                realizó cada operario.
              </p>

              <Link
                href="/dashboard/staff/tasks/new"
                className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Registrar primera tarea
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Operario</th>
                    <th className="py-2 pr-3">Orden</th>
                    <th className="py-2 pr-3">Producto</th>
                    <th className="py-2 pr-3">Etapa</th>
                    <th className="py-2 pr-3">Descripción</th>
                    <th className="py-2 pr-3 text-right">Horas</th>
                    <th className="py-2 pr-3 text-right">Estado</th>
                    <th className="py-2 pr-3">Registrado por</th>
                    <th className="py-2 text-right">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {latestTasks.map((task) => (
                    <tr key={task.id_tarea_operario} className="border-b">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {task.id_tarea_operario}
                      </td>

                      <td className="py-2 pr-3">
                        {formatDate(task.fecha_tarea)}
                      </td>

                      <td className="py-2 pr-3 font-medium">
                        {task.operario.apellidos}, {task.operario.nombres}
                      </td>

                      <td className="py-2 pr-3 font-mono text-xs">
                        {task.id_orden_trabajo}
                      </td>

                      <td className="py-2 pr-3">
                        {task.orden_trabajo.producto.nombre_producto}
                      </td>

                      <td className="py-2 pr-3">
                        {task.etapa_ruta?.nombre_etapa ?? "-"}
                      </td>

                      <td className="py-2 pr-3">
                        {task.descripcion}
                        {task.observaciones ? (
                          <p className="text-xs text-muted-foreground">
                            {task.observaciones}
                          </p>
                        ) : null}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {formatHours(task.horas_dedicadas)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        <Badge variant={getTaskBadgeVariant(task.estado)}>
                          {getTaskStatusLabel(task.estado)}
                        </Badge>
                      </td>

                      <td className="py-2 pr-3">
                        {task.usuario.nombres} {task.usuario.apellidos}
                      </td>

                      <td className="py-2 text-right">
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

                            <button
                              type="submit"
                              className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                            >
                              Anular
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}