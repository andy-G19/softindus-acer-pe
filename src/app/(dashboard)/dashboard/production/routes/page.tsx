import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { toggleFabricationRouteStatusAction } from "@/modules/production/routes/actions";

type FabricationRoutesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
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

function getStatusFilter(status: string) {
  if (status === "active") {
    return true;
  }

  if (status === "inactive") {
    return false;
  }

  return undefined;
}

export default async function FabricationRoutesPage({
  searchParams,
}: FabricationRoutesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const product = getSearchParam(params, "product");
  const status = getSearchParam(params, "status");
  const statusFilter = getStatusFilter(status);
  const filters: Prisma.ruta_fabricacionWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_ruta: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_ruta: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          producto: {
            nombre_producto: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
      ],
    });
  }

  if (product) {
    filters.push({
      id_producto: product,
    });
  }

  if (statusFilter !== undefined) {
    filters.push({
      estado: statusFilter,
    });
  }

  const where: Prisma.ruta_fabricacionWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [routes, products] = await Promise.all([
    prisma.ruta_fabricacion.findMany({
      where,
      include: {
        producto: true,
        _count: {
          select: {
            etapa_ruta: true,
            orden_trabajo: true,
          },
        },
      },
      orderBy: [
        {
          estado: "desc",
        },
        {
          nombre_ruta: "asc",
        },
      ],
    }),
    prisma.producto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_producto: "asc",
      },
      select: {
        id_producto: true,
        nombre_producto: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Rutas de fabricación"
        description="Consulta las rutas productivas definidas para cada producto del taller."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Rutas" },
        ])}
        actions={
          <Link
            href="/dashboard/production/routes/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Nueva ruta
          </Link>
        }
      />

      <form className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-[1.5fr_1fr_1fr_auto_auto]">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar ruta, codigo o producto..."
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />

        <select
          name="product"
          defaultValue={product}
          className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los productos</option>
          {products.map((item) => (
            <option key={item.id_producto} value={item.id_producto}>
              {item.nombre_producto}
            </option>
          ))}
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
          href="/dashboard/production/routes"
          className="rounded-lg border px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Limpiar filtros
        </Link>
      </form>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Código</th>
              <th className="px-4 py-3 font-semibold">Ruta</th>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Categoría</th>
              <th className="px-4 py-3 font-semibold">Etapas</th>
              <th className="px-4 py-3 font-semibold">Órdenes asociadas</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {routes.map((route) => (
              <tr key={route.id_ruta} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">
                  {route.id_ruta}
                </td>

                <td className="px-4 py-3">
                  <div className="font-medium">{route.nombre_ruta}</div>

                  {route.descripcion ? (
                    <p className="mt-1 max-w-xl text-xs text-slate-500">
                      {route.descripcion}
                    </p>
                  ) : null}
                </td>

                <td className="px-4 py-3">
                  {route.producto.nombre_producto}
                </td>

                <td className="px-4 py-3 capitalize">
                  {route.producto.categoria}
                </td>

                <td className="px-4 py-3">
                  {route._count.etapa_ruta}
                </td>

                <td className="px-4 py-3">
                  {route._count.orden_trabajo}
                </td>

                <td className="px-4 py-3">
                  {route.estado ? (
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
                      href={`/dashboard/production/routes/${route.id_ruta}/edit`}
                      className="text-sm font-medium text-slate-600 hover:text-slate-950"
                    >
                      Editar
                    </Link>

                    <Link
                      href={`/dashboard/production/routes/${route.id_ruta}/stages`}
                      className="text-sm font-medium text-slate-600 hover:text-slate-950"
                    >
                      Gestionar etapas
                    </Link>

                    <form action={toggleFabricationRouteStatusAction}>
                      <input
                        type="hidden"
                        name="id_ruta"
                        value={route.id_ruta}
                      />

                      <button
                        type="submit"
                        className="text-left text-sm font-medium text-slate-600 hover:text-slate-950"
                      >
                        {route.estado ? "Inactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}

            {routes.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Todavía no hay rutas de fabricación registradas.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div>
        <Link
          href="/dashboard/production"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Volver al módulo de producción
        </Link>
      </div>
    </main>
  );
}
