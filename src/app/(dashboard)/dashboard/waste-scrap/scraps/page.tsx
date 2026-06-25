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

type SearchParams = {
  estado?: string;
  material?: string;
  q?: string;
};

type ScrapsPageProps = {
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
  if (["acumulada", "disponible"].includes(status)) {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "vendida") {
    return "bg-blue-50 text-blue-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default async function ScrapsPage({ searchParams }: ScrapsPageProps) {
  const session = await requireRole([
      APP_ROLES.ADMIN,
      APP_ROLES.WORKSHOP_MASTER,
  ]);

  const canRegisterSale = session.user.role === APP_ROLES.ADMIN;

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
              id_chatarra: {
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
              observaciones: {
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
    scraps,
    totalFiltered,
    totalScraps,
    chatarraAcumulada,
    chatarraVendida,
    filteredTotals,
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

    prisma.chatarra.findMany({
      where,
      orderBy: {
        fecha_registro: "desc",
      },
      include: {
        material: true,
        venta_chatarra: {
          orderBy: {
            fecha_venta: "desc",
          },
          take: 1,
        },
      },
    }),

    prisma.chatarra.count({
      where,
    }),

    prisma.chatarra.count(),

    prisma.chatarra.count({
      where: {
        estado: "acumulada",
      },
    }),

    prisma.chatarra.count({
      where: {
        estado: "vendida",
      },
    }),

    prisma.chatarra.aggregate({
      where,
      _sum: {
        peso_kg: true,
        cantidad: true,
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
            Chatarra generada
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta los materiales no reutilizables acumulados durante la
            producción. Puedes filtrar por estado, material de origen o buscar
            por código, tipo de material u observación.
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
            href="/dashboard/waste-scrap/scraps/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Registrar chatarra
          </Link>

          {canRegisterSale ? (
          <Link
            href="/dashboard/waste-scrap/scrap-sales/new"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Registrar venta
          </Link>
            ) : null}

        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Total registros
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{totalScraps}</p>
            <p className="mt-1 text-xs text-slate-500">
              {totalFiltered} según filtros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Acumulada
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{chatarraAcumulada}</p>
            <p className="mt-1 text-xs text-slate-500">
              Pendiente de venta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Vendida
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{chatarraVendida}</p>
            <p className="mt-1 text-xs text-slate-500">
              Ya generó ingreso menor
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Peso filtrado
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">
              {formatNumber(filteredTotals._sum.peso_kg)} kg
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Cantidad: {formatNumber(filteredTotals._sum.cantidad)}
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
              <option value="acumulada">Acumulada</option>
              <option value="disponible">Disponible</option>
              <option value="vendida">Vendida</option>
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
              placeholder="Código, tipo u observación"
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
                href="/dashboard/waste-scrap/scraps"
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
          <h2 className="text-lg font-semibold">Listado de chatarra</h2>
          <p className="mt-1 text-sm text-slate-500">
            {totalFiltered} registro(s) encontrado(s).
          </p>
        </div>

        {scraps.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">
            No se encontraron registros de chatarra con los filtros
            seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Material origen</th>
                  <th className="px-5 py-3">Peso</th>
                  <th className="px-5 py-3">Cantidad</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Observación</th>
                  <th className="px-5 py-3">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {scraps.map((item) => {
                  const latestSale = item.venta_chatarra[0];

                  return (
                    <tr key={item.id_chatarra} className="align-top">
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">
                        {item.id_chatarra}
                      </td>

                      <td className="px-5 py-4 font-medium">
                        {item.tipo_material}
                      </td>

                      <td className="px-5 py-4">
                        {item.material ? (
                          <div>
                            <p className="font-medium">
                              {item.material.nombre_material}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.material.categoria}
                            </p>
                          </div>
                        ) : (
                          "No identificado"
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {item.peso_kg
                          ? `${formatNumber(item.peso_kg)} kg`
                          : "-"}
                      </td>

                      <td className="px-5 py-4">
                        {item.cantidad ? formatNumber(item.cantidad) : "-"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
                              item.estado,
                            )}`}
                          >
                            {item.estado}
                          </span>

                          {latestSale ? (
                            <p className="text-xs text-slate-500">
                              Vendida el {formatDate(latestSale.fecha_venta)}
                            </p>
                          ) : null}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {formatDate(item.fecha_registro)}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {item.observaciones ?? "-"}
                      </td>

                      <td className="px-5 py-4">
                      {canRegisterSale && item.estado !== "vendida" ? (
                        <Link
                          href={`/dashboard/waste-scrap/scrap-sales/new?id_chatarra=${item.id_chatarra}`}
                          className="text-sm font-medium text-slate-700 hover:text-slate-950"
                        >
                          Vender →
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}