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
import { updateRepairStatusAction } from "@/modules/maintenance/repairs/actions";

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

function getRepairStatusLabel(status: string) {
  const labels: Record<string, string> = {
    programada: "Programada",
    ejecutada: "Ejecutada",
    observada: "Observada",
    anulada: "Anulada",
  };

  return labels[status] ?? status;
}

function getRepairStatusBadgeVariant(status: string) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    programada: "secondary",
    ejecutada: "default",
    observada: "outline",
    anulada: "destructive",
  };

  return variants[status] ?? "secondary";
}

export default async function RepairsPage() {
  const session = await requireRole([APP_ROLES.ADMIN]);

  const canManageRepairs = session.user.role === APP_ROLES.ADMIN;

  const repairs = await prisma.reparacion.findMany({
    orderBy: {
      fecha_reparacion: "desc",
    },
    include: {
      falla_maquina: {
        include: {
          maquina: true,
        },
      },
      detalle_repuesto_reparacion: {
        include: {
          repuesto: true,
        },
      },
    },
  });

  const scheduledRepairs = repairs.filter(
    (repair) => repair.estado_reparacion === "programada",
  );

  const executedRepairs = repairs.filter(
    (repair) => repair.estado_reparacion === "ejecutada",
  );

  const observedRepairs = repairs.filter(
    (repair) => repair.estado_reparacion === "observada",
  );

  const cancelledRepairs = repairs.filter(
    (repair) => repair.estado_reparacion === "anulada",
  );

  const totalCost = repairs.reduce((total, repair) => {
    return total + toNumber(repair.costo_total);
  }, 0);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Mantenimiento de maquinaria · Reparaciones
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Listado de reparaciones
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta las reparaciones registradas por falla, máquina, técnico,
            mano de obra, repuestos utilizados y costo total.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/maintenance"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          {canManageRepairs ? (
            <Link
              href="/dashboard/maintenance/repairs/new"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Registrar reparación
            </Link>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reparaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{repairs.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Total histórico.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Programadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{scheduledRepairs.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Observadas: {observedRepairs.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ejecutadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{executedRepairs.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Anuladas: {cancelledRepairs.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costo total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(totalCost)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Mano de obra + repuestos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(repairs.length > 0 ? totalCost / repairs.length : 0)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Costo promedio por reparación.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reparaciones registradas</CardTitle>
        </CardHeader>

        <CardContent>
          {repairs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium">
                Aún no hay reparaciones registradas.
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                Registra una reparación para calcular mano de obra, repuestos y
                costo total de mantenimiento.
              </p>

              {canManageRepairs ? (
                <Link
                  href="/dashboard/maintenance/repairs/new"
                  className="mt-4 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Registrar primera reparación
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Código</th>
                    <th className="py-2 pr-3">Máquina / Falla</th>
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Técnico</th>
                    <th className="py-2 pr-3 text-right">Mano de obra</th>
                    <th className="py-2 pr-3 text-right">Repuestos</th>
                    <th className="py-2 pr-3 text-right">Costo total</th>
                    <th className="py-2 pr-3 text-right">Estado</th>
                    {canManageRepairs ? (
                      <th className="py-2 text-right">Cambiar estado</th>
                    ) : null}
                  </tr>
                </thead>

                <tbody>
                  {repairs.map((repair) => {
                    const sparePartsTotal =
                      repair.detalle_repuesto_reparacion.reduce(
                        (total, detail) => total + toNumber(detail.subtotal),
                        0,
                      );

                    return (
                      <tr
                        key={repair.id_reparacion}
                        className="border-b align-top"
                      >
                        <td className="py-2 pr-3 font-mono text-xs">
                          {repair.id_reparacion}
                        </td>

                        <td className="py-2 pr-3 font-medium">
                          {repair.falla_maquina.maquina.nombre}
                          <p className="max-w-md text-xs font-normal text-muted-foreground">
                            Falla: {repair.falla_maquina.descripcion}
                          </p>

                          {repair.detalle_repuesto_reparacion.length > 0 ? (
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              {repair.detalle_repuesto_reparacion.map(
                                (detail) => (
                                  <p key={detail.id_detalle_repuesto}>
                                    {detail.repuesto.nombre_repuesto} ×{" "}
                                    {detail.cantidad.toString()} ={" "}
                                    {formatMoney(detail.subtotal)}
                                  </p>
                                ),
                              )}
                            </div>
                          ) : null}
                        </td>

                        <td className="py-2 pr-3">
                          {formatDate(repair.fecha_reparacion)}
                        </td>

                        <td className="py-2 pr-3">
                          {repair.tecnico_proveedor ?? "-"}
                        </td>

                        <td className="py-2 pr-3 text-right">
                          {formatMoney(repair.mano_obra)}
                        </td>

                        <td className="py-2 pr-3 text-right">
                          {formatMoney(sparePartsTotal)}
                        </td>

                        <td className="py-2 pr-3 text-right font-medium">
                          {formatMoney(repair.costo_total)}
                        </td>

                        <td className="py-2 pr-3 text-right">
                          <Badge
                            variant={getRepairStatusBadgeVariant(
                              repair.estado_reparacion,
                            )}
                          >
                            {getRepairStatusLabel(repair.estado_reparacion)}
                          </Badge>
                        </td>

                        {canManageRepairs ? (
                          <td className="py-2 text-right">
                            <form
                              action={updateRepairStatusAction}
                              className="flex justify-end gap-2"
                            >
                              <input
                                type="hidden"
                                name="id_reparacion"
                                value={repair.id_reparacion}
                              />

                              <select
                                name="estado_reparacion"
                                defaultValue={repair.estado_reparacion}
                                className="rounded-md border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-slate-300"
                              >
                                <option value="programada">Programada</option>
                                <option value="ejecutada">Ejecutada</option>
                                <option value="observada">Observada</option>
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