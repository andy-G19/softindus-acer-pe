import { notFound } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { reassignWorkOrderProgressAction } from "@/modules/production/work-order-progress/actions";
import Link from "next/link";

type ReassignWorkOrderProgressPageProps = {
  params: Promise<{
    id: string;
    advanceId: string;
  }>;
};

export default async function ReassignWorkOrderProgressPage({
  params,
}: ReassignWorkOrderProgressPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const { id, advanceId } = await params;

  const advance = await prisma.avance_orden.findFirst({
    where: {
      id_avance: advanceId,
      id_orden_trabajo: id,
    },
    include: {
      etapa_ruta: true,
      operario: true,
      orden_trabajo: {
        include: {
          producto: true,
        },
      },
      reasignacion_tarea: {
        include: {
          operario_reasignacion_tarea_id_operario_anteriorTooperario: true,
          operario_reasignacion_tarea_id_operario_nuevoTooperario: true,
          usuario: true,
        },
        orderBy: {
          fecha_reasignacion: "desc",
        },
        take: 5,
      },
    },
  });

  if (!advance) {
    notFound();
  }

  const isClosedOrder = ["finalizada", "anulada"].includes(
    advance.orden_trabajo.estado,
  );

  const operators = await prisma.operario.findMany({
    where: {
      estado: "activo",
      id_operario: advance.id_operario
        ? {
            not: advance.id_operario,
          }
        : undefined,
    },
    orderBy: [
      {
        apellidos: "asc",
      },
      {
        nombres: "asc",
      },
    ],
  });

  const canReassign = !isClosedOrder && operators.length > 0;
  const operatorItems = operators.map((operator) => ({
    id: operator.id_operario,
    label: `${operator.apellidos}, ${operator.nombres}`,
    description: operator.cargo ?? "Operario",
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Reasignar avance"
        description={`Orden: ${advance.orden_trabajo.id_orden_trabajo} · Producto: ${advance.orden_trabajo.producto.nombre_producto}`}
        backHref={`/dashboard/production/work-orders/${advance.orden_trabajo.id_orden_trabajo}/progress`}
        backLabel="Volver a avances"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Órdenes de trabajo", href: navigationHrefs.workOrders },
          { label: "Reasignar avance" },
        ])}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <KpiCard
          title="Etapa"
          value={`${advance.etapa_ruta.orden_secuencia}. ${advance.etapa_ruta.nombre_etapa}`}
          description="Etapa del avance."
        />
        <KpiCard
          title="Operario actual"
          value={
            advance.operario
              ? `${advance.operario.apellidos}, ${advance.operario.nombres}`
              : "Sin operario asignado"
          }
          description="Antes de la reasignación."
        />
      </section>

      {isClosedOrder ? (
        <Alert variant="destructive">
          <AlertDescription>
            No se puede reasignar un avance de una orden finalizada o
            anulada.
          </AlertDescription>
        </Alert>
      ) : null}

      {!isClosedOrder && operators.length === 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            No hay operarios activos disponibles para esta reasignación.
          </AlertDescription>
        </Alert>
      ) : null}

      <form
        action={reassignWorkOrderProgressAction}
        className="space-y-5 rounded-xl border border-border/80 bg-card p-6 shadow-sm"
      >
        <input type="hidden" name="id_avance" value={advance.id_avance} />

        <SearchableSelect
          name="id_operario_nuevo"
          label="Nuevo operario"
          placeholder="Buscar operario activo..."
          items={operatorItems}
          required
          disabled={!canReassign}
          emptyMessage="No hay operarios activos disponibles."
        />

        <div className="space-y-2">
          <Label>Motivo de reasignación *</Label>
          <Textarea
            name="motivo"
            rows={4}
            required
            maxLength={255}
            disabled={!canReassign}
            placeholder="Ej. Operario reasignado por carga de trabajo o ausencia."
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button variant="link" className="h-auto p-0" asChild>
            <Link
              href={`/dashboard/production/work-orders/${advance.orden_trabajo.id_orden_trabajo}/progress`}
            >
              Cancelar
            </Link>
          </Button>

          <Button type="submit" disabled={!canReassign}>
            Guardar reasignación
          </Button>
        </div>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial reciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
                className="rounded-lg border border-border/80 bg-secondary/40 p-4 text-sm"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <p className="font-medium text-foreground">
                    {previousOperator
                      ? `${previousOperator.apellidos}, ${previousOperator.nombres}`
                      : "Sin operario anterior"}{" "}
                    -&gt; {nextOperator.apellidos}, {nextOperator.nombres}
                  </p>

                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(reassignment.fecha_reasignacion)}
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

          {advance.reasignacion_tarea.length === 0 ? (
            <EmptyState label="Este avance todavía no tiene reasignaciones registradas." />
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
