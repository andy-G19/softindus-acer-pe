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

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Personal, asistencia y pagos · Nueva tarea
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Registrar tarea diaria
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Asocia un operario con una orden de trabajo, una etapa productiva
            opcional, la fecha de actividad, descripción y horas dedicadas.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Fase 8.4</Badge>
          <Badge>ADMIN / Maestro de taller</Badge>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Datos de la tarea</CardTitle>
          </CardHeader>

          <CardContent>
            {!hasRequiredData ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  Faltan datos para registrar tareas.
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Debes tener al menos un operario activo y una orden de trabajo
                  registrada o en proceso.
                </p>

                <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                  <Link
                    href="/dashboard/staff/operators"
                    className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
                  >
                    Ver operarios
                  </Link>

                  <Link
                    href="/dashboard/production/work-orders"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Ver órdenes
                  </Link>
                </div>
              </div>
            ) : (
              <form action={createOperatorTaskAction} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="id_operario" className="text-sm font-medium">
                    Operario
                  </label>

                  <select
                    id="id_operario"
                    name="id_operario"
                    required
                    defaultValue=""
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="" disabled>
                      Seleccione un operario
                    </option>

                    {operators.map((operator) => (
                      <option
                        key={operator.id_operario}
                        value={operator.id_operario}
                      >
                        {operator.apellidos}, {operator.nombres} ·{" "}
                        {operator.cargo ?? "Sin cargo"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="id_orden_trabajo"
                    className="text-sm font-medium"
                  >
                    Orden de trabajo
                  </label>

                  <select
                    id="id_orden_trabajo"
                    name="id_orden_trabajo"
                    required
                    defaultValue=""
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="" disabled>
                      Seleccione una orden de trabajo
                    </option>

                    {workOrders.map((order) => (
                      <option
                        key={order.id_orden_trabajo}
                        value={order.id_orden_trabajo}
                      >
                        {order.id_orden_trabajo} ·{" "}
                        {order.producto.nombre_producto} · Cantidad:{" "}
                        {order.cantidad.toString()} · Estado: {order.estado} ·
                        Inicio: {formatDate(order.fecha_inicio)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="id_etapa_ruta" className="text-sm font-medium">
                    Etapa de producción
                  </label>

                  <select
                    id="id_etapa_ruta"
                    name="id_etapa_ruta"
                    defaultValue=""
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  >
                    <option value="">
                      Sin etapa específica
                    </option>

                    {stages.map((stage) => (
                      <option
                        key={stage.id_etapa_ruta}
                        value={stage.id_etapa_ruta}
                      >
                        {stage.ruta_fabricacion.producto.nombre_producto} ·{" "}
                        {stage.ruta_fabricacion.nombre_ruta} ·{" "}
                        {stage.orden_secuencia}. {stage.nombre_etapa}
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-muted-foreground">
                    Importante: si seleccionas una etapa, debe pertenecer a la
                    ruta de fabricación de la orden seleccionada.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label htmlFor="fecha_tarea" className="text-sm font-medium">
                      Fecha de tarea
                    </label>

                    <input
                      id="fecha_tarea"
                      name="fecha_tarea"
                      type="date"
                      required
                      defaultValue={today}
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="horas_dedicadas"
                      className="text-sm font-medium"
                    >
                      Horas dedicadas
                    </label>

                    <input
                      id="horas_dedicadas"
                      name="horas_dedicadas"
                      type="number"
                      min="0"
                      max="24"
                      step="0.01"
                      placeholder="Ejemplo: 4.50"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="estado" className="text-sm font-medium">
                      Estado
                    </label>

                    <select
                      id="estado"
                      name="estado"
                      required
                      defaultValue="registrada"
                      className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="registrada">Registrada</option>
                      <option value="en_proceso">En proceso</option>
                      <option value="terminada">Terminada</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="descripcion" className="text-sm font-medium">
                    Descripción de la tarea
                  </label>

                  <input
                    id="descripcion"
                    name="descripcion"
                    type="text"
                    required
                    placeholder="Ejemplo: Corte de piezas para lote de lampas"
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="observaciones" className="text-sm font-medium">
                    Observaciones
                  </label>

                  <textarea
                    id="observaciones"
                    name="observaciones"
                    rows={4}
                    placeholder="Ejemplo: Se avanzó parcialmente por falta de material."
                    className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="submit"
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Registrar tarea
                  </button>

                  <Link
                    href="/dashboard/staff/tasks"
                    className="rounded-md border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted"
                  >
                    Ver listado
                  </Link>
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