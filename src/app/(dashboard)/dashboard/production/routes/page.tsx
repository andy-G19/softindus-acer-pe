import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

export default async function FabricationRoutesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const routes = await prisma.ruta_fabricacion.findMany({
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
  });

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Producción · Rutas de fabricación
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Rutas de fabricación
          </h1>

          <p className="max-w-3xl text-slate-600">
            Consulta las rutas productivas definidas para cada producto del
            taller. En la siguiente subfase agregaremos las etapas internas de
            cada ruta.
          </p>
        </div>

        <Link
          href="/dashboard/production/routes/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva ruta
        </Link>
      </section>

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
                  <Link
                    href={`/dashboard/production/routes/${route.id_ruta}/stages`}
                    className="text-sm font-medium text-slate-600 hover:text-slate-950"
                  >
                    Ver etapas
                  </Link>
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