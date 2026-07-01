import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { SearchableSelect } from "@/components/forms/searchable-select";
import { prisma } from "@/lib/db";
import { reassignWorkOrderProgressAction } from "@/modules/production/work-order-progress/actions";

type ReassignWorkOrderProgressPageProps = {
  params: Promise<{
    id: string;
    advanceId: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
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

export default async function ReassignWorkOrderProgressPage({
  params,
}: ReassignWorkOrderProgressPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

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
      <section>
        <p className="text-sm font-medium text-slate-500">
          Produccion - Ordenes de trabajo - Avances
        </p>

        <h1 className="text-3xl font-bold tracking-tight">
          Reasignar avance
        </h1>

        <p className="mt-2 text-slate-600">
          Orden:{" "}
          <span className="font-medium">
            {advance.orden_trabajo.id_orden_trabajo}
          </span>{" "}
          - Producto:{" "}
          <span className="font-medium">
            {advance.orden_trabajo.producto.nombre_producto}
          </span>
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Etapa</p>
          <p className="mt-2 font-semibold">
            {advance.etapa_ruta.orden_secuencia}.{" "}
            {advance.etapa_ruta.nombre_etapa}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Operario actual</p>
          <p className="mt-2 font-semibold">
            {advance.operario
              ? `${advance.operario.apellidos}, ${advance.operario.nombres}`
              : "Sin operario asignado"}
          </p>
        </div>
      </section>

      {isClosedOrder ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          No se puede reasignar un avance de una orden finalizada o anulada.
        </section>
      ) : null}

      {!isClosedOrder && operators.length === 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          No hay operarios activos disponibles para esta reasignacion.
        </section>
      ) : null}

      <form
        action={reassignWorkOrderProgressAction}
        className="space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="id_avance" value={advance.id_avance} />

        <div className="space-y-2">
          <SearchableSelect
            name="id_operario_nuevo"
            label="Nuevo operario"
            placeholder="Buscar operario activo..."
            items={operatorItems}
            required
            disabled={!canReassign}
            emptyMessage="No hay operarios activos disponibles."
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Motivo de reasignacion *
          </label>

          <textarea
            name="motivo"
            rows={4}
            required
            maxLength={255}
            disabled={!canReassign}
            placeholder="Ej. Operario reasignado por carga de trabajo o ausencia."
            className="w-full rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-slate-100"
          />
        </div>

        <div className="flex items-center justify-between pt-4">
          <Link
            href={`/dashboard/production/work-orders/${advance.orden_trabajo.id_orden_trabajo}/progress`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={!canReassign}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Guardar reasignacion
          </button>
        </div>
      </form>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Historial reciente</h2>

        <div className="mt-4 space-y-3">
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
                className="rounded-lg border bg-slate-50 p-4 text-sm"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <p className="font-medium text-slate-900">
                    {previousOperator
                      ? `${previousOperator.apellidos}, ${previousOperator.nombres}`
                      : "Sin operario anterior"}{" "}
                    -&gt; {nextOperator.apellidos}, {nextOperator.nombres}
                  </p>

                  <span className="text-xs text-slate-500">
                    {formatDateTime(reassignment.fecha_reasignacion)}
                  </span>
                </div>

                <p className="mt-2 text-slate-600">{reassignment.motivo}</p>

                <p className="mt-1 text-xs text-slate-500">
                  Responsable: {reassignment.usuario.nombres}{" "}
                  {reassignment.usuario.apellidos}
                </p>
              </div>
            );
          })}

          {advance.reasignacion_tarea.length === 0 ? (
            <p className="text-sm text-slate-500">
              Este avance todavia no tiene reasignaciones registradas.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
