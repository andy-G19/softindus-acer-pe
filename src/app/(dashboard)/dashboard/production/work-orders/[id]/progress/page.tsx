import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/formatters";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import {
  generateWorkOrderProgressAction,
  updateWorkOrderProgressAction,
} from "@/modules/production/work-order-progress/actions";

type WorkOrderProgressPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function getStageBadgeVariant(status: string) {
  if (status === "terminada") {
    return "success" as const;
  }

  if (status === "en_proceso") {
    return "info" as const;
  }

  if (status === "pausada") {
    return "warning" as const;
  }

  return "secondary" as const;
}

function getOrderBadgeVariant(status: string) {
  if (status === "finalizada") {
    return "success" as const;
  }

  if (status === "en_proceso") {
    return "info" as const;
  }

  if (status === "pausada") {
    return "warning" as const;
  }

  if (status === "anulada") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

function getDefaultPercentageByStatus(status: string, currentPercentage: unknown) {
  if (status === "pendiente") {
    return 0;
  }

  if (status === "terminada") {
    return 100;
  }

  const value = toNumber(currentPercentage);

  if (value <= 0) {
    return 1;
  }

  if (value >= 100) {
    return 99;
  }

  return value;
}

export default async function WorkOrderProgressPage({
  params,
  searchParams,
}: WorkOrderProgressPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  const workOrder = await prisma.orden_trabajo.findUnique({
    where: {
      id_orden_trabajo: id,
    },
    include: {
      producto: true,
      ruta_fabricacion: {
        include: {
          etapa_ruta: {
            where: {
              estado: true,
            },
            orderBy: {
              orden_secuencia: "asc",
            },
          },
        },
      },
      avance_orden: {
        include: {
          etapa_ruta: true,
          operario: true,
          usuario: true,
          reasignacion_tarea: {
            include: {
              operario_reasignacion_tarea_id_operario_anteriorTooperario: true,
              operario_reasignacion_tarea_id_operario_nuevoTooperario: true,
              usuario: true,
            },
            orderBy: {
              fecha_reasignacion: "desc",
            },
          },
        },
      },
    },
  });

  if (!workOrder) {
    notFound();
  }

  const backHref = getSafeReturnTo(
    queryParams.returnTo,
    navigationHrefs.workOrders,
  );

  const sortedAdvances = [...workOrder.avance_orden].sort(
    (a, b) => a.etapa_ruta.orden_secuencia - b.etapa_ruta.orden_secuencia,
  );

  const totalStages = sortedAdvances.length;
  const finishedStages = sortedAdvances.filter(
    (advance) => advance.estado_etapa === "terminada",
  ).length;
  const inProgressStages = sortedAdvances.filter(
    (advance) => advance.estado_etapa === "en_proceso",
  ).length;
  const pausedStages = sortedAdvances.filter(
    (advance) => advance.estado_etapa === "pausada",
  ).length;

  const averageProgress =
    totalStages === 0
      ? 0
      : sortedAdvances.reduce(
          (total, advance) => total + toNumber(advance.porcentaje_avance),
          0,
        ) / totalStages;

  const canGenerateProgress =
    sortedAdvances.length === 0 &&
    workOrder.estado !== "anulada" &&
    workOrder.estado !== "finalizada" &&
    Boolean(workOrder.ruta_fabricacion) &&
    (workOrder.ruta_fabricacion?.etapa_ruta.length ?? 0) > 0;

  const canEditProgress =
    workOrder.estado !== "anulada" && workOrder.estado !== "finalizada";

  return (
    <main className="space-y-6">
      <PageHeader
        title="Avances de producción"
        description={`Orden: ${workOrder.id_orden_trabajo} · Producto: ${workOrder.producto.nombre_producto} · Cantidad: ${formatDecimal(workOrder.cantidad)} ${workOrder.producto.unidad_medida}`}
        backHref={backHref}
        backLabel="Volver a órdenes"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Órdenes de trabajo", href: backHref },
          {
            label: workOrder.id_orden_trabajo,
            href: `${navigationHrefs.workOrders}/${workOrder.id_orden_trabajo}`,
          },
          { label: "Avances" },
        ])}
        actions={
          <Badge variant={getOrderBadgeVariant(workOrder.estado)}>
            {workOrder.estado}
          </Badge>
        }
      />

      <section className="grid gap-4 md:grid-cols-5">
        <KpiCard title="Etapas generadas" value={totalStages.toString()} description="Total de la ruta." tone="info" />
        <KpiCard title="En proceso" value={inProgressStages.toString()} description="Con avance activo." tone="info" />
        <KpiCard title="Pausadas" value={pausedStages.toString()} description="Requieren atención." tone="warning" />
        <KpiCard title="Terminadas" value={finishedStages.toString()} description="Etapas completadas." tone="success" />
        <KpiCard title="Avance general" value={`${averageProgress.toFixed(2)}%`} description="Promedio de todas las etapas." tone="info" />
      </section>

      {sortedAdvances.length === 0 ? (
        <section className="rounded-xl border border-border/80 bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            La orden todavía no tiene avances generados
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            El sistema puede crear automáticamente un avance por cada etapa
            activa de la ruta de fabricación asociada a esta orden.
          </p>

          {!workOrder.ruta_fabricacion ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                Esta orden no tiene una ruta de fabricación asociada.
              </AlertDescription>
            </Alert>
          ) : null}

          {workOrder.ruta_fabricacion &&
          workOrder.ruta_fabricacion.etapa_ruta.length === 0 ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>
                La ruta asociada no tiene etapas activas.
              </AlertDescription>
            </Alert>
          ) : null}

          <form action={generateWorkOrderProgressAction} className="mt-5">
            <input
              type="hidden"
              name="id_orden_trabajo"
              value={workOrder.id_orden_trabajo}
            />

            <Button type="submit" disabled={!canGenerateProgress}>
              Generar avances por etapa
            </Button>
          </form>
        </section>
      ) : null}

      {sortedAdvances.length > 0 ? (
        <section className="space-y-4">
          {sortedAdvances.map((advance) => {
            const defaultPercentage = getDefaultPercentageByStatus(
              advance.estado_etapa,
              advance.porcentaje_avance,
            );

            return (
              <form
                key={advance.id_avance}
                action={updateWorkOrderProgressAction}
                className="rounded-xl border border-border/80 bg-card p-5 shadow-sm"
              >
                <input type="hidden" name="id_avance" value={advance.id_avance} />

                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {advance.id_avance}
                    </p>

                    <h2 className="mt-1 text-xl font-semibold text-foreground">
                      {advance.etapa_ruta.orden_secuencia}.{" "}
                      {advance.etapa_ruta.nombre_etapa}
                    </h2>

                    {advance.etapa_ruta.descripcion ? (
                      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                        {advance.etapa_ruta.descripcion}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-muted-foreground">
                      Actualizado por: {advance.usuario.nombres}{" "}
                      {advance.usuario.apellidos}
                    </p>
                  </div>

                  <Badge variant={getStageBadgeVariant(advance.estado_etapa)}>
                    {advance.estado_etapa}
                  </Badge>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Estado *</Label>
                    <NativeSelect
                      name="estado_etapa"
                      required
                      defaultValue={advance.estado_etapa}
                      disabled={!canEditProgress}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_proceso">En proceso</option>
                      <option value="pausada">Pausada</option>
                      <option value="terminada">Terminada</option>
                    </NativeSelect>
                  </div>

                  <div className="space-y-2">
                    <Label>Porcentaje *</Label>
                    <Input
                      name="porcentaje_avance"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      defaultValue={defaultPercentage}
                      disabled={!canEditProgress}
                    />
                    <p className="text-xs text-muted-foreground">
                      Pendiente se guarda como 0%. Terminada se guarda como
                      100%.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Operario</Label>
                    <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {advance.operario
                            ? `${advance.operario.apellidos}, ${advance.operario.nombres}`
                            : "Sin operario asignado"}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {advance.operario?.cargo ?? "Operario de producción"}
                        </p>
                      </div>

                      {canEditProgress ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/dashboard/production/work-orders/${workOrder.id_orden_trabajo}/progress/${advance.id_avance}/reassign`}
                          >
                            Reasignar
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-3">
                  <div className="rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm">
                    <p className="text-muted-foreground">Inicio de etapa</p>
                    <p className="mt-1 font-medium text-foreground">
                      {formatDateTime(advance.fecha_inicio_etapa)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm">
                    <p className="text-muted-foreground">Fin de etapa</p>
                    <p className="mt-1 font-medium text-foreground">
                      {formatDateTime(advance.fecha_fin_etapa)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm">
                    <p className="text-muted-foreground">Máquina</p>
                    <p className="mt-1 font-medium text-foreground">
                      {advance.etapa_ruta.requiere_maquina
                        ? "Requiere máquina"
                        : "No requiere máquina"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <Label>Observaciones</Label>
                  <Textarea
                    name="observaciones"
                    rows={3}
                    maxLength={700}
                    defaultValue={advance.observaciones ?? ""}
                    disabled={!canEditProgress}
                    placeholder="Ej. Etapa pausada por falta de material o máquina ocupada."
                  />
                </div>

                <div className="mt-5 flex justify-end">
                  <Button type="submit" disabled={!canEditProgress}>
                    Actualizar etapa
                  </Button>
                </div>

                {advance.reasignacion_tarea.length > 0 ? (
                  <div className="mt-5 rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm">
                    <p className="font-medium text-foreground">
                      Historial de reasignaciones
                    </p>

                    <div className="mt-3 space-y-3">
                      {advance.reasignacion_tarea.map((reassignment) => {
                        const previousOperator =
                          reassignment
                            .operario_reasignacion_tarea_id_operario_anteriorTooperario;
                        const nextOperator =
                          reassignment
                            .operario_reasignacion_tarea_id_operario_nuevoTooperario;

                        return (
                          <div
                            key={reassignment.id_reasignacion}
                            className="rounded-md border border-border/80 bg-card p-3"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <p className="font-medium text-foreground">
                                {previousOperator
                                  ? `${previousOperator.apellidos}, ${previousOperator.nombres}`
                                  : "Sin operario anterior"}{" "}
                                -&gt; {nextOperator.apellidos},{" "}
                                {nextOperator.nombres}
                              </p>

                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(
                                  reassignment.fecha_reasignacion,
                                )}
                              </span>
                            </div>

                            <p className="mt-2 text-muted-foreground">
                              {reassignment.motivo}
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              Responsable: {reassignment.usuario.nombres}{" "}
                              {reassignment.usuario.apellidos}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </form>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
