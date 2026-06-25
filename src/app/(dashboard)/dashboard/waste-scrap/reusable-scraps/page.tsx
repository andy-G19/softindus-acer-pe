import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";
import { updateReusableScrapStatusAction } from "@/modules/waste-scrap/reusable-scraps/status-actions";

type SearchParams = {
  estado?: string;
  material?: string;
  q?: string;
};

type ReusableScrapsPageProps = {
  searchParams?: Promise<SearchParams>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatNumber(value: unknown) {
  return new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

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

function getStatusClass(status: string) {
  if (status === "disponible") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "reutilizado") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "descartado") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default async function ReusableScrapsPage({
  searchParams,
}: ReusableScrapsPageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const params = searchParams ? await searchParams : {};

  const estado = params.estado?.trim() ?? "";
  const material = params.material?.trim() ?? "";
  const query = params.q?.trim() ?? "";

  const where = {
    ...(estado
      ? {
          estado,
        }
      : {}),

    ...(material
      ? {
          id_material: material,
        }
      : {}),

    ...(query
      ? {
          OR: [
            {
              id_retazo: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              tipo_material: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              medida_aproximada: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              ubicacion: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
            {
              id_orden_trabajo: {
                contains: query,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [
    materials,
    retazos,
    totalFiltered,
    totalRetazos,
    retazosDisponibles,
    retazosReutilizados,
    retazosDescartados,
  ] = await Promise.all([
    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
      select: {
        id_material: true,
        nombre_material: true,
        categoria: true,
      },
    }),

    prisma.retazo_reutilizable.findMany({
      where,
      orderBy: {
        fecha_registro: "desc",
      },
      include: {
        material: true,
        orden_trabajo: {
          include: {
            producto: true,
            cliente: true,
          },
        },
        usuario: true,
      },
    }),

    prisma.retazo_reutilizable.count({
      where,
    }),

    prisma.retazo_reutilizable.count(),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "disponible",
      },
    }),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "reutilizado",
      },
    }),

    prisma.retazo_reutilizable.count({
      where: {
        estado: "descartado",
      },
    }),
  ]);

  const hasFilters = Boolean(estado || material || query);

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Mermas y chatarra · Consulta
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Retazos reutilizables
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta los retazos aprovechables registrados durante producción.
            Puedes filtrar por estado, material de origen o buscar por código,
            medida, ubicación u orden de trabajo. Desde este listado también puedes
            marcar retazos disponibles como reutilizados o descartados.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/waste-scrap"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Volver al módulo
          </Link>

          <Link
            href="/dashboard/waste-scrap/reusable-scraps/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Registrar retazo
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Total registrados
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{totalRetazos}</p>
            <p className="mt-1 text-xs text-slate-500">
              {totalFiltered} según filtros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Disponibles
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{retazosDisponibles}</p>
            <p className="mt-1 text-xs text-slate-500">
              Listos para reutilizar
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Reutilizados
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{retazosReutilizados}</p>
            <p className="mt-1 text-xs text-slate-500">
              Aprovechados en producción
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Descartados
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{retazosDescartados}</p>
            <p className="mt-1 text-xs text-slate-500">
              No aprovechables
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_1.2fr_auto]">
          <div className="space-y-2">
            <label
              htmlFor="estado"
              className="text-sm font-medium text-slate-700"
            >
              Estado
            </label>

            <select
              id="estado"
              name="estado"
              defaultValue={estado}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Todos</option>
              <option value="disponible">Disponible</option>
              <option value="reutilizado">Reutilizado</option>
              <option value="descartado">Descartado</option>
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="material"
              className="text-sm font-medium text-slate-700"
            >
              Material
            </label>

            <select
              id="material"
              name="material"
              defaultValue={material}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            >
              <option value="">Todos</option>

              {materials.map((item) => (
                <option key={item.id_material} value={item.id_material}>
                  {item.nombre_material} · {item.categoria}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="q" className="text-sm font-medium text-slate-700">
              Buscar
            </label>

            <input
              id="q"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Código, medida, ubicación u orden"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Filtrar
            </button>

            {hasFilters ? (
              <Link
                href="/dashboard/waste-scrap/reusable-scraps"
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
              >
                Limpiar
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="rounded-xl border bg-white shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold">Listado de retazos</h2>
          <p className="mt-1 text-sm text-slate-500">
            {totalFiltered} registro(s) encontrado(s).
          </p>
        </div>

        {retazos.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            No se encontraron retazos con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Material</th>
                  <th className="px-5 py-3">Cantidad</th>
                  <th className="px-5 py-3">Medida</th>
                  <th className="px-5 py-3">Ubicación</th>
                  <th className="px-5 py-3">Orden</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {retazos.map((item) => (
                  <tr key={item.id_retazo} className="align-top">
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">
                      {item.id_retazo}
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium">
                        {item.material.nombre_material}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.tipo_material}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      {formatNumber(item.cantidad)} {item.unidad_medida}
                    </td>

                    <td className="px-5 py-4">
                      {item.medida_aproximada ?? "-"}
                    </td>

                    <td className="px-5 py-4">{item.ubicacion ?? "-"}</td>

                    <td className="px-5 py-4">
                      {item.orden_trabajo ? (
                        <div>
                          <p className="font-mono text-xs">
                            {item.orden_trabajo.id_orden_trabajo}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.orden_trabajo.producto.nombre_producto}
                          </p>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
                          item.estado,
                        )}`}
                      >
                        {item.estado}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {formatDate(item.fecha_registro)}
                    </td>

                    <td className="px-5 py-4">
                      {item.estado === "disponible" ? (
                        <div className="flex flex-col gap-2">
                          <form action={updateReusableScrapStatusAction}>
                            <input type="hidden" name="id_retazo" value={item.id_retazo} />
                            <input type="hidden" name="estado" value="reutilizado" />
                    
                            <button
                              type="submit"
                              className="text-sm font-medium text-blue-700 hover:text-blue-900"
                            >
                              Reutilizar →
                            </button>
                          </form>
                    
                          <form action={updateReusableScrapStatusAction}>
                            <input type="hidden" name="id_retazo" value={item.id_retazo} />
                            <input type="hidden" name="estado" value="descartado" />
                    
                            <button
                              type="submit"
                              className="text-sm font-medium text-red-700 hover:text-red-900"
                            >
                              Descartar →
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Sin acción</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}