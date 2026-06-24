import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { toggleRouteStageStatusAction } from "@/modules/production/stages/actions";

type RouteStagesPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/access-denied");
  }
}

function formatHours(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Number(value.toString()).toFixed(2)} h`;
}

export default async function RouteStagesPage({
  params,
}: RouteStagesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;

  const route = await prisma.ruta_fabricacion.findUnique({
    where: {
      id_ruta: id,
    },
    include: {
      producto: true,
      etapa_ruta: {
        include: {
          _count: {
            select: {
              avance_orden: true,
              tarea_operario: true,
            },
          },
        },
        orderBy: {
          orden_secuencia: "asc",
        },
      },
    },
  });

  if (!route) {
    notFound();
  }

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Producción · Rutas de fabricación · Etapas
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Etapas de la ruta
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Ruta: <span className="font-medium">{route.nombre_ruta}</span> ·
            Producto:{" "}
            <span className="font-medium">
              {route.producto.nombre_producto}
            </span>
          </p>

          {route.descripcion ? (
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              {route.descripcion}
            </p>
          ) : null}
        </div>

        <Link
          href={`/dashboard/production/routes/${route.id_ruta}/stages/new`}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva etapa
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Etapas registradas</p>
          <p className="mt-2 text-3xl font-bold">{route.etapa_ruta.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Etapas activas</p>
          <p className="mt-2 text-3xl font-bold">
            {route.etapa_ruta.filter((stage) => stage.estado).length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Requieren máquina</p>
          <p className="mt-2 text-3xl font-bold">
            {route.etapa_ruta.filter((stage) => stage.requiere_maquina).length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Tiempo estimado total</p>
          <p className="mt-2 text-3xl font-bold">
            {route.etapa_ruta
              .reduce((total, stage) => {
                if (!stage.tiempo_estimado_horas) {
                  return total;
                }

                return total + Number(stage.tiempo_estimado_horas.toString());
              }, 0)
              .toFixed(2)}{" "}
            h
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Orden</th>
              <th className="px-4 py-3 font-semibold">Etapa</th>
              <th className="px-4 py-3 font-semibold">Tiempo estimado</th>
              <th className="px-4 py-3 font-semibold">Máquina</th>
              <th className="px-4 py-3 font-semibold">Avances</th>
              <th className="px-4 py-3 font-semibold">Tareas</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acción</th>
            </tr>
          </thead>

          <tbody>
            {route.etapa_ruta.map((stage) => (
              <tr key={stage.id_etapa_ruta} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">
                  {stage.orden_secuencia}
                </td>

                <td className="px-4 py-3">
                  <div className="font-medium">{stage.nombre_etapa}</div>

                  {stage.descripcion ? (
                    <p className="mt-1 max-w-xl text-xs text-slate-500">
                      {stage.descripcion}
                    </p>
                  ) : null}
                </td>

                <td className="px-4 py-3">
                  {formatHours(stage.tiempo_estimado_horas)}
                </td>

                <td className="px-4 py-3">
                  {stage.requiere_maquina ? (
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                      Requiere
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      No requiere
                    </span>
                  )}
                </td>

                <td className="px-4 py-3">{stage._count.avance_orden}</td>

                <td className="px-4 py-3">{stage._count.tarea_operario}</td>

                <td className="px-4 py-3">
                  {stage.estado ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                      Activa
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      Inactiva
                    </span>
                  )}
                </td>

                <td className="px-4 py-3">
                  <form action={toggleRouteStageStatusAction}>
                    <input
                      type="hidden"
                      name="id_etapa_ruta"
                      value={stage.id_etapa_ruta}
                    />

                    <button
                      type="submit"
                      className="text-sm font-medium text-slate-600 hover:text-slate-950"
                    >
                      {stage.estado ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}

            {route.etapa_ruta.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Esta ruta todavía no tiene etapas registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/production/routes"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Volver a rutas
        </Link>

        <Link
          href="/dashboard/production"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver al módulo producción
        </Link>
      </div>
    </main>
  );
}