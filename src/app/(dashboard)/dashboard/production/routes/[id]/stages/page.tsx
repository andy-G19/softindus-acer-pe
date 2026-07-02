import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { toggleRouteStageStatusAction } from "@/modules/production/stages/actions";

type RouteStagesPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function formatHours(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${Number(value.toString()).toFixed(2)} h`;
}

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function getBooleanFilter(value: string) {
  if (value === "yes") {
    return true;
  }

  if (value === "no") {
    return false;
  }

  return undefined;
}

function getStatusFilter(status: string) {
  if (status === "active") {
    return true;
  }

  if (status === "inactive") {
    return false;
  }

  return undefined;
}

export default async function RouteStagesPage({
  params,
  searchParams,
}: RouteStagesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};
  const q = getSearchParam(queryParams, "q");
  const requiresMachine = getSearchParam(queryParams, "requiresMachine");
  const status = getSearchParam(queryParams, "status");
  const machineFilter = getBooleanFilter(requiresMachine);
  const statusFilter = getStatusFilter(status);
  const stageFilters: Prisma.etapa_rutaWhereInput[] = [];

  if (q) {
    stageFilters.push({
      nombre_etapa: {
        contains: q,
        mode: "insensitive",
      },
    });
  }

  if (machineFilter !== undefined) {
    stageFilters.push({
      requiere_maquina: machineFilter,
    });
  }

  if (statusFilter !== undefined) {
    stageFilters.push({
      estado: statusFilter,
    });
  }

  const route = await prisma.ruta_fabricacion.findUnique({
    where: {
      id_ruta: id,
    },
    include: {
      producto: true,
      etapa_ruta: {
        where: stageFilters.length > 0 ? { AND: stageFilters } : undefined,
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

      <form className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-[1.5fr_1fr_1fr_auto_auto]">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar etapa..."
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />

        <select
          name="requiresMachine"
          defaultValue={requiresMachine}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Maquina: todos</option>
          <option value="yes">Requiere maquina</option>
          <option value="no">No requiere maquina</option>
        </select>

        <select
          name="status"
          defaultValue={status}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
        </select>

        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Filtrar
        </button>

        <Link
          href={`/dashboard/production/routes/${route.id_ruta}/stages`}
          className="rounded-lg border px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Limpiar filtros
        </Link>
      </form>

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
              <th className="px-4 py-3 font-semibold">Acciones</th>
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
                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/dashboard/production/routes/${route.id_ruta}/stages/${stage.id_etapa_ruta}/edit`}
                      className="text-sm font-medium text-slate-600 hover:text-slate-950"
                    >
                      Editar
                    </Link>

                    <form action={toggleRouteStageStatusAction}>
                      <input
                        type="hidden"
                        name="id_etapa_ruta"
                        value={stage.id_etapa_ruta}
                      />

                      <button
                        type="submit"
                        className="text-left text-sm font-medium text-slate-600 hover:text-slate-950"
                      >
                        {stage.estado ? "Inactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
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
