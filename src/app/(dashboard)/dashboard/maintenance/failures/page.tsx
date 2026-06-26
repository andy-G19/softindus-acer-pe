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
import { updateFailureStatusAction } from "@/modules/maintenance/failures/actions";

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatHours(value: unknown) {
  return `${toNumber(value).toFixed(2)} h`;
}

function getFailureStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendiente: "Pendiente",
    en_atencion: "En atención",
    reparada: "Reparada",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

function getFailureStatusBadgeVariant(status: string) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    pendiente: "secondary",
    en_atencion: "default",
    reparada: "outline",
    anulada: "destructive",
  };

  return variants[status] ?? "secondary";
}

export default async function FailuresPage() {
  const session = await requireRole([
    APP_ROLES.ADMIN,
    APP_ROLES.WORKSHOP_MASTER,
  ]);

  const canManageFailures =
    session.user.role === APP_ROLES.ADMIN ||
    session.user.role === APP_ROLES.WORKSHOP_MASTER;

  const failures = await prisma.falla_maquina.findMany({
    orderBy: {
      fecha_falla: "desc",
    },
    include: {
      maquina: true,
      _count: {
        select: {
          reparacion: true,
        },
      },
    },
  });

  const pendingFailures = failures.filter(
    (failure) => failure.estado_atencion === "pendiente",
  );

  const inAttentionFailures = failures.filter(
    (failure) => failure.estado_atencion === "en_atencion",
  );

  const repairedFailures = failures.filter(
    (failure) => failure.estado_atencion === "reparada",
  );

  const cancelledFailures = failures.filter(
    (failure) => failure.estado_atencion === "anulada",
  );

  const totalLostHours = failures.reduce((total, failure) => {
    return total + toNumber(failure.tiempo_perdido_horas);
  }, 0);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Mantenimiento de maquinaria · Fallas
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Listado de fallas
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta las fallas registradas por máquina, su estado de atención,
            tiempo perdido, impacto en producción y trazabilidad de
            reparaciones asociadas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/maintenance"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          {canManageFailures ? (
            <Link
              href="/dashboard/maintenance/failures/new"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Registrar falla
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fallas registradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{failures.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total histórico de fallas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingFailures.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Aún no atendidas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">En atención</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{inAttentionFailures.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Requieren seguimiento.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reparadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{repairedFailures.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Anuladas: {cancelledFailures.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tiempo perdido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatHours(totalLostHours)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Acumulado por fallas.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fallas registradas</CardTitle>
        </CardHeader>

        <CardContent>
          {failures.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Aún no hay fallas registradas.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Registra la primera falla para documentar paradas, problemas
                técnicos y tiempos perdidos.
              </p>

              {canManageFailures ? (
                <Link
                  href="/dashboard/maintenance/failures/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar primera falla
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
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Descripción</th>
                    <th className="py-2 pr-3">Responsable</th>
                    <th className="py-2 pr-3 text-right">Tiempo perdido</th>
                    <th className="py-2 pr-3 text-right">Reparaciones</th>
                    <th className="py-2 pr-3 text-right">Estado</th>
                    {canManageFailures ? (
                      <th className="py-2 text-right">Cambiar estado</th>
                    ) : null}
                  </tr>
                </thead>

                <tbody>
                  {failures.map((failure) => (
                    <tr key={failure.id_falla} className="border-b align-top">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {failure.id_falla}
                      </td>

                      <td className="py-2 pr-3 font-medium">
                        {failure.maquina.nombre}
                        <p className="text-xs font-normal text-muted-foreground">
                          {failure.maquina.codigo_interno ?? "Sin código interno"}
                        </p>
                      </td>

                      <td className="py-2 pr-3">
                        {formatDateTime(failure.fecha_falla)}
                      </td>

                      <td className="py-2 pr-3">
                        <p className="max-w-md">{failure.descripcion}</p>

                        {failure.impacto_produccion ? (
                          <p className="mt-1 max-w-md text-xs text-muted-foreground">
                            Impacto: {failure.impacto_produccion}
                          </p>
                        ) : null}
                      </td>

                      <td className="py-2 pr-3">
                        {failure.responsable_registro ?? "-"}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {formatHours(failure.tiempo_perdido_horas)}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        {failure._count.reparacion}
                      </td>

                      <td className="py-2 pr-3 text-right">
                        <Badge
                          variant={getFailureStatusBadgeVariant(
                            failure.estado_atencion,
                          )}
                        >
                          {getFailureStatusLabel(failure.estado_atencion)}
                        </Badge>
                      </td>

                      {canManageFailures ? (
                        <td className="py-2 text-right">
                          <form
                            action={updateFailureStatusAction}
                            className="flex justify-end gap-2"
                          >
                            <input
                              type="hidden"
                              name="id_falla"
                              value={failure.id_falla}
                            />

                            <select
                              name="estado_atencion"
                              defaultValue={failure.estado_atencion}
                              className="rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-slate-300"
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="en_atencion">En atención</option>
                              <option value="reparada">Reparada</option>
                              <option value="anulada">Anulada</option>
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