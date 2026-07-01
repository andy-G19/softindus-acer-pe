import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  generateWorkOrderProgressAction,
  updateWorkOrderProgressAction,
} from "@/modules/production/work-order-progress/actions";

type WorkOrderProgressPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getStageStatusClass(status: string) {
  if (status === "terminada") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "en_proceso") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "pausada") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-slate-100 text-slate-700";
}

function getOrderStatusClass(status: string) {
  if (status === "finalizada") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "en_proceso") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "pausada") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "anulada") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
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
}: WorkOrderProgressPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;

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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Producción · Órdenes de trabajo · Avances
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Avances de producción
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Orden:{" "}
            <span className="font-medium">{workOrder.id_orden_trabajo}</span> ·
            Producto:{" "}
            <span className="font-medium">
              {workOrder.producto.nombre_producto}
            </span>{" "}
            · Cantidad:{" "}
            <span className="font-medium">
              {formatDecimal(workOrder.cantidad)}{" "}
              {workOrder.producto.unidad_medida}
            </span>
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${getOrderStatusClass(
            workOrder.estado,
          )}`}
        >
          {workOrder.estado}
        </span>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Etapas generadas</p>
          <p className="mt-2 text-3xl font-bold">{totalStages}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">En proceso</p>
          <p className="mt-2 text-3xl font-bold">{inProgressStages}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pausadas</p>
          <p className="mt-2 text-3xl font-bold">{pausedStages}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Terminadas</p>
          <p className="mt-2 text-3xl font-bold">{finishedStages}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Avance general</p>
          <p className="mt-2 text-3xl font-bold">
            {averageProgress.toFixed(2)}%
          </p>
        </div>
      </section>

      {sortedAdvances.length === 0 ? (
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            La orden todavía no tiene avances generados
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            El sistema puede crear automáticamente un avance por cada etapa
            activa de la ruta de fabricación asociada a esta orden.
          </p>

          {!workOrder.ruta_fabricacion ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Esta orden no tiene una ruta de fabricación asociada.
            </p>
          ) : null}

          {workOrder.ruta_fabricacion &&
          workOrder.ruta_fabricacion.etapa_ruta.length === 0 ? (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              La ruta asociada no tiene etapas activas.
            </p>
          ) : null}

          <form action={generateWorkOrderProgressAction} className="mt-5">
            <input
              type="hidden"
              name="id_orden_trabajo"
              value={workOrder.id_orden_trabajo}
            />

            <button
              type="submit"
              disabled={!canGenerateProgress}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Generar avances por etapa
            </button>
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
                className="rounded-xl border bg-white p-5 shadow-sm"
              >
                <input
                  type="hidden"
                  name="id_avance"
                  value={advance.id_avance}
                />

                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                  <div>
                    <p className="font-mono text-xs text-slate-400">
                      {advance.id_avance}
                    </p>

                    <h2 className="mt-1 text-xl font-semibold">
                      {advance.etapa_ruta.orden_secuencia}.{" "}
                      {advance.etapa_ruta.nombre_etapa}
                    </h2>

                    {advance.etapa_ruta.descripcion ? (
                      <p className="mt-1 max-w-3xl text-sm text-slate-600">
                        {advance.etapa_ruta.descripcion}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-slate-500">
                      Actualizado por: {advance.usuario.nombres}{" "}
                      {advance.usuario.apellidos}
                    </p>
                  </div>

                  <span
                    className={`w-fit rounded-full px-2 py-1 text-xs font-medium ${getStageStatusClass(
                      advance.estado_etapa,
                    )}`}
                  >
                    {advance.estado_etapa}
                  </span>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Estado *</label>

                    <select
                      name="estado_etapa"
                      required
                      defaultValue={advance.estado_etapa}
                      disabled={!canEditProgress}
                      className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="en_proceso">En proceso</option>
                      <option value="pausada">Pausada</option>
                      <option value="terminada">Terminada</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Porcentaje *
                    </label>

                    <input
                      name="porcentaje_avance"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      required
                      defaultValue={defaultPercentage}
                      disabled={!canEditProgress}
                      className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
                    />

                    <p className="text-xs text-slate-500">
                      Pendiente se guarda como 0%. Terminada se guarda como
                      100%.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium">Operario</label>

                    <div className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-3 text-sm md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">
                          {advance.operario
                            ? `${advance.operario.apellidos}, ${advance.operario.nombres}`
                            : "Sin operario asignado"}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {advance.operario?.cargo ?? "Operario de produccion"}
                        </p>
                      </div>

                      {canEditProgress ? (
                        <Link
                          href={`/dashboard/production/work-orders/${workOrder.id_orden_trabajo}/progress/${advance.id_avance}/reassign`}
                          className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Reasignar
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-3">
                  <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                    <p className="text-slate-500">Inicio de etapa</p>
                    <p className="mt-1 font-medium">
                      {formatDateTime(advance.fecha_inicio_etapa)}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                    <p className="text-slate-500">Fin de etapa</p>
                    <p className="mt-1 font-medium">
                      {formatDateTime(advance.fecha_fin_etapa)}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                    <p className="text-slate-500">Máquina</p>
                    <p className="mt-1 font-medium">
                      {advance.etapa_ruta.requiere_maquina
                        ? "Requiere máquina"
                        : "No requiere máquina"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  <label className="text-sm font-medium">Observaciones</label>

                  <textarea
                    name="observaciones"
                    rows={3}
                    maxLength={700}
                    defaultValue={advance.observaciones ?? ""}
                    disabled={!canEditProgress}
                    placeholder="Ej. Etapa pausada por falta de material o máquina ocupada."
                    className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
                  />
                </div>

                <div className="mt-5 flex justify-end">
                  <button
                    type="submit"
                    disabled={!canEditProgress}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Actualizar etapa
                  </button>
                </div>

                {advance.reasignacion_tarea.length > 0 ? (
                  <div className="mt-5 rounded-lg border bg-slate-50 p-4 text-sm">
                    <p className="font-medium text-slate-900">
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
                            className="rounded-md border bg-white p-3"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <p className="font-medium text-slate-800">
                                {previousOperator
                                  ? `${previousOperator.apellidos}, ${previousOperator.nombres}`
                                  : "Sin operario anterior"}{" "}
                                -&gt; {nextOperator.apellidos},{" "}
                                {nextOperator.nombres}
                              </p>

                              <span className="text-xs text-slate-500">
                                {formatDateTime(
                                  reassignment.fecha_reasignacion,
                                )}
                              </span>
                            </div>

                            <p className="mt-2 text-slate-600">
                              {reassignment.motivo}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
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

      <div className="rounded-xl border bg-slate-50 p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-900">
          Regla automática aplicada
        </p>

        <p className="mt-1">
          Si todas las etapas están terminadas, la orden pasa a finalizada. Si
          existe una etapa en proceso, la orden pasa a en_proceso. Si existe una
          etapa pausada y ninguna está en proceso, la orden pasa a pausada.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/production/work-orders/${workOrder.id_orden_trabajo}`}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Volver a detalle de orden
        </Link>

        <Link
          href="/dashboard/production/work-orders"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver a órdenes
        </Link>
      </div>
    </main>
  );
}

