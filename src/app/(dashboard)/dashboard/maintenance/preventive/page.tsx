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
import { updatePreventiveMaintenanceStatusAction } from "@/modules/maintenance/preventive/actions";

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

function getPreventiveStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    realizado: "Realizado",
    vencido: "Vencido",
    anulado: "Anulado",
  };

  return labels[status] ?? status;
}

function getPreventiveStatusBadgeVariant(status: string) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    pendiente: "secondary",
    realizado: "default",
    vencido: "destructive",
    anulado: "outline",
  };

  return variants[status] ?? "secondary";
}

function getMachineStatusLabel(status: string) {
  const labels: Record<string, string> = {
    operativa: "Operativa",
    en_reparacion: "En mantenimiento",
    inactiva: "Inactiva",
    dada_de_baja: "Fuera de servicio",
  };

  return labels[status] ?? status;
}

export default async function PreventiveMaintenancePage() {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const canManagePreventive = session.user.role === APP_ROLES.ADMIN;

  const today = new Date();

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const maintenances = await prisma.mantenimiento_preventivo.findMany({
    orderBy: [
      {
        fecha_programada: "asc",
      },
      {
        estado: "asc",
      },
    ],
    include: {
      maquina: true,
      usuario: true,
    },
  });

  const pendingMaintenances = maintenances.filter(
    (maintenance) => maintenance.estado === "pendiente",
  );

  const completedMaintenances = maintenances.filter(
    (maintenance) => maintenance.estado === "realizado",
  );

  const overdueMaintenances = maintenances.filter((maintenance) => {
    return (
      maintenance.estado === "pendiente" &&
      maintenance.fecha_programada < startOfToday
    );
  });

  const cancelledMaintenances = maintenances.filter(
    (maintenance) => maintenance.estado === "anulado",
  );

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Mantenimiento de maquinaria · Preventivos
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Mantenimientos preventivos
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Programa y consulta mantenimientos preventivos por máquina,
            responsable, fecha programada, fecha realizada y estado de
            cumplimiento.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/maintenance"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          {canManagePreventive ? (
            <Link
              href="/dashboard/maintenance/preventive/new"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Programar preventivo
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preventivos registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{maintenances.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total histórico de programaciones.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingMaintenances.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Vencidos: {overdueMaintenances.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Realizados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{completedMaintenances.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cumplidos según registro.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anulados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{cancelledMaintenances.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Programaciones canceladas.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Programaciones preventivas
          </CardTitle>
        </CardHeader>

        <CardContent>
          {maintenances.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Aún no hay mantenimientos preventivos registrados.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Programa el primer mantenimiento preventivo para anticipar
                fallas y reducir paradas imprevistas.
              </p>

              {canManagePreventive ? (
                <Link
                  href="/dashboard/maintenance/preventive/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Programar primer preventivo
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Máquina</th>
                    <th className="py-2 pr-3">Actividad</th>
                    <th className="py-2 pr-3">Responsable</th>
                    <th className="py-2 pr-3">Programada</th>
                    <th className="py-2 pr-3">Realizada</th>
                    <th className="py-2 pr-3">Usuario</th>
                    <th className="py-2 pr-3 text-right">Estado</th>
                    {canManagePreventive ? (
                      <th className="py-2 text-right">Cambiar estado</th>
                    ) : null}
                  </tr>
                </thead>

                <tbody>
                  {maintenances.map((maintenance) => {
                    const isOverdue =
                      maintenance.estado === "pendiente" &&
                      maintenance.fecha_programada < startOfToday;

                    return (
                      <tr
                        key={maintenance.id_mantenimiento}
                        className="border-b align-top"
                      >
                        <td className="py-2 pr-3 font-mono text-xs">
                          {maintenance.id_mantenimiento}
                        </td>

                        <td className="py-2 pr-3 font-medium">
                          {maintenance.maquina.nombre}
                          <p className="text-xs font-normal text-muted-foreground">
                            {maintenance.maquina.tipo} ·{" "}
                            {getMachineStatusLabel(maintenance.maquina.estado)}
                          </p>
                        </td>

                        <td className="py-2 pr-3">
                          <p className="max-w-md">{maintenance.actividad}</p>

                          {maintenance.observaciones ? (
                            <p className="mt-1 max-w-md text-xs text-muted-foreground">
                              {maintenance.observaciones}
                            </p>
                          ) : null}
                        </td>

                        <td className="py-2 pr-3">
                          {maintenance.responsable ?? "-"}
                        </td>

                        <td className="py-2 pr-3">
                          {formatDate(maintenance.fecha_programada)}
                          {isOverdue ? (
                            <p className="text-xs text-red-600">Vencido</p>
                          ) : null}
                        </td>

                        <td className="py-2 pr-3">
                          {formatDate(maintenance.fecha_realizada)}
                        </td>

                        <td className="py-2 pr-3">
                          {maintenance.usuario.nombres}{" "}
                          {maintenance.usuario.apellidos}
                        </td>

                        <td className="py-2 pr-3 text-right">
                          <Badge
                            variant={getPreventiveStatusBadgeVariant(
                              isOverdue ? "vencido" : maintenance.estado,
                            )}
                          >
                            {isOverdue
                              ? "Vencido"
                              : getPreventiveStatusLabel(maintenance.estado)}
                          </Badge>
                        </td>

                        {canManagePreventive ? (
                          <td className="py-2 text-right">
                            <form
                              action={updatePreventiveMaintenanceStatusAction}
                              className="flex justify-end gap-2"
                            >
                              <input
                                type="hidden"
                                name="id_mantenimiento"
                                value={maintenance.id_mantenimiento}
                              />

                              <select
                                name="estado"
                                defaultValue={
                                  isOverdue ? "vencido" : maintenance.estado
                                }
                                className="rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-slate-300"
                              >
                                <option value="pendiente">Pendiente</option>
                                <option value="realizado">Realizado</option>
                                <option value="vencido">Vencido</option>
                                <option value="anulado">Anulado</option>
                              </select>

                              <button
                                type="submit"
                                className="rounded-md border px-3 py-1 text-xs font-medium transition hover:bg-muted"
                              >
                                Guardar
                              </button>
                            </form>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}