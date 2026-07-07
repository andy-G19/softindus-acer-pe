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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { createOperatorTaskAction } from "@/modules/staff/tasks/actions";

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

export default async function NewOperatorTaskPage() {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const today = new Date().toISOString().split("T")[0];

  const [operators, workOrders, stages] = await Promise.all([
    prisma.operario.findMany({
      where: {
        estado: "activo",
      },
      orderBy: [
        {
          apellidos: "asc",
        },
        {
          nombres: "asc",
        },
      ],
    }),

    prisma.orden_trabajo.findMany({
      where: {
        estado: {
          not: "anulada",
        },
      },
      orderBy: [
        {
          fecha_inicio: "desc",
        },
        {
          id_orden_trabajo: "desc",
        },
      ],
      take: 50,
      include: {
        producto: true,
        cliente: true,
        ruta_fabricacion: true,
      },
    }),

    prisma.etapa_ruta.findMany({
      where: {
        estado: true,
      },
      orderBy: [
        {
          ruta_fabricacion: {
            nombre_ruta: "asc",
          },
        },
        {
          orden_secuencia: "asc",
        },
      ],
      include: {
        ruta_fabricacion: {
          include: {
            producto: true,
          },
        },
      },
    }),
  ]);

  const hasRequiredData = operators.length > 0 && workOrders.length > 0;
  const operatorItems = operators.map((operator) => ({
    id: operator.id_operario,
    label: `${operator.apellidos}, ${operator.nombres}`,
    description: operator.cargo ?? "Sin cargo",
  }));
  const workOrderItems = workOrders.map((order) => ({
    id: order.id_orden_trabajo,
    label: `${order.id_orden_trabajo} - ${order.producto.nombre_producto}`,
    description: `Cantidad: ${order.cantidad.toString()} - Estado: ${order.estado} - Inicio: ${formatDate(order.fecha_inicio)}`,
  }));
  const stageItems = stages.map((stage) => ({
    id: stage.id_etapa_ruta,
    label: `${stage.ruta_fabricacion.producto.nombre_producto} - ${stage.nombre_etapa}`,
    description: `${stage.ruta_fabricacion.nombre_ruta} - Secuencia ${stage.orden_secuencia}`,
  }));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Registrar tarea diaria"
        description="Asocia un operario con una orden de trabajo, una etapa productiva opcional, la fecha de actividad, descripción y horas dedicadas."
        backHref="/dashboard/staff/tasks"
        backLabel="Volver al listado"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Personal", href: navigationHrefs.staff },
          { label: "Tareas diarias", href: "/dashboard/staff/tasks" },
          { label: "Nueva tarea" },
        ])}
        actions={<Badge>ADMIN / Maestro de taller</Badge>}
      />

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos de la tarea</CardTitle>
          </CardHeader>

          <CardContent>
            {!hasRequiredData ? (
              <EmptyState
                label="Faltan datos para registrar tareas."
                description="Debes tener al menos un operario activo y una orden de trabajo registrada o en proceso."
                action={
                  <div className="flex flex-col justify-center gap-2 sm:flex-row">
                    <Button variant="outline" asChild>
                      <Link href="/dashboard/staff/operators">
                        Ver operarios
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link href="/dashboard/production/work-orders">
                        Ver órdenes
                      </Link>
                    </Button>
                  </div>
                }
              />
            ) : (
              <form action={createOperatorTaskAction} className="space-y-4">
                <div className="space-y-2">
                  <SearchableSelect
                    name="id_operario"
                    label="Operario"
                    placeholder="Buscar operario..."
                    items={operatorItems}
                    required
                    emptyMessage="No hay operarios activos disponibles."
                  />
                </div>

                <div className="space-y-2">
                  <SearchableSelect
                    name="id_orden_trabajo"
                    label="Orden de trabajo"
                    placeholder="Buscar orden..."
                    items={workOrderItems}
                    required
                    emptyMessage="No hay órdenes de trabajo disponibles."
                  />
                </div>

                <div className="space-y-2">
                  <SearchableSelect
                    name="id_etapa_ruta"
                    label="Etapa de producción"
                    placeholder="Buscar etapa..."
                    items={stageItems}
                    emptyMessage="No hay etapas activas disponibles."
                  />

                  <p className="text-xs text-muted-foreground">
                    Importante: si seleccionas una etapa, debe pertenecer a la
                    ruta de fabricación de la orden seleccionada.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="fecha_tarea">Fecha de tarea</Label>
                    <Input
                      id="fecha_tarea"
                      name="fecha_tarea"
                      type="date"
                      required
                      defaultValue={today}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="horas_dedicadas">Horas dedicadas</Label>
                    <Input
                      id="horas_dedicadas"
                      name="horas_dedicadas"
                      type="number"
                      min="0"
                      max="24"
                      step="0.01"
                      placeholder="Ejemplo: 4.50"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <NativeSelect
                      id="estado"
                      name="estado"
                      required
                      defaultValue="registrada"
                    >
                      <option value="registrada">Registrada</option>
                      <option value="en_proceso">En proceso</option>
                      <option value="terminada">Terminada</option>
                    </NativeSelect>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descripcion">Descripción de la tarea</Label>
                  <Input
                    id="descripcion"
                    name="descripcion"
                    type="text"
                    required
                    placeholder="Ejemplo: Corte de piezas para lote de lampas"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    name="observaciones"
                    rows={4}
                    placeholder="Ejemplo: Se avanzó parcialmente por falta de material."
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="submit">Registrar tarea</Button>
                  <Button variant="outline" asChild>
                    <Link href="/dashboard/staff/tasks">Ver listado</Link>
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reglas de uso</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Una tarea diaria permite saber qué hizo cada operario durante la
              jornada.
            </p>

            <p>
              La orden de trabajo es obligatoria porque la actividad debe quedar
              vinculada a producción.
            </p>

            <p>
              La etapa es opcional, pero si se selecciona debe pertenecer a la
              ruta de fabricación de la orden.
            </p>

            <p>
              Las horas dedicadas ayudarán más adelante a calcular mano de obra
              y planillas.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
