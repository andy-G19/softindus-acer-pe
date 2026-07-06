import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/navigation/page-header";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { changeProductionCampaignStatusAction } from "@/modules/production/campaigns/actions";

type ProductionCampaignsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function requireProductionAccess(role: string | undefined) {
  if (!["ADMIN", "WORKSHOP_MASTER"].includes(role ?? "")) {
    redirect("/dashboard/access-denied");
  }
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(value);
}

function formatDecimal(value: unknown) {
  if (value === null || value === undefined) {
    return "0.00";
  }

  return Number(value.toString()).toFixed(2);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function getStatusClass(status: string) {
  if (status === "activa") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "planificada") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "finalizada") {
    return "bg-slate-100 text-slate-700";
  }

  if (status === "anulada") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
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

function parseDate(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function ProductionCampaignsPage({
  searchParams,
}: ProductionCampaignsPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const params = (await searchParams) ?? {};
  const q = getSearchParam(params, "q");
  const product = getSearchParam(params, "product");
  const status = getSearchParam(params, "status");
  const from = getSearchParam(params, "from");
  const to = getSearchParam(params, "to");
  const fromDate = parseDate(from);
  const toDate = parseDate(to, true);
  const filters: Prisma.campania_produccionWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_campania: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          nombre_campania: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  if (product) {
    filters.push({
      campania_detalle: {
        some: {
          id_producto: product,
        },
      },
    });
  }

  if (status) {
    filters.push({
      estado: status,
    });
  }

  if (fromDate || toDate) {
    filters.push({
      fecha_inicio: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    });
  }

  const where: Prisma.campania_produccionWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [campaigns, products] = await Promise.all([
    prisma.campania_produccion.findMany({
      where,
      include: {
        campania_detalle: {
          select: {
            cantidad_objetivo: true,
            cantidad_producida: true,
          },
        },
        _count: {
          select: {
            campania_detalle: true,
            orden_trabajo: true,
          },
        },
      },
      orderBy: [
        {
          fecha_inicio: "desc",
        },
        {
          id_campania: "desc",
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

  const activeCampaigns = campaigns.filter((campaign) =>
    ["planificada", "activa"].includes(campaign.estado),
  );
  const totalTarget = campaigns.reduce((total, campaign) => {
    return (
      total +
      campaign.campania_detalle.reduce(
        (detailTotal, detail) =>
          detailTotal + toNumber(detail.cantidad_objetivo),
        0,
      )
    );
  }, 0);
  const totalProduced = campaigns.reduce((total, campaign) => {
    return (
      total +
      campaign.campania_detalle.reduce(
        (detailTotal, detail) =>
          detailTotal + toNumber(detail.cantidad_producida),
        0,
      )
    );
  }, 0);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Campañas de producción"
        description="Planifica lotes de producción por campaña y consulta el avance por producto."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Campañas" },
        ])}
        actions={
          <Link
            href="/dashboard/production/campaigns/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Nueva campaña
          </Link>
        }
      />

      <form className="grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar campaña..."
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
          <option value="planificada">Planificada</option>
          <option value="activa">Activa</option>
          <option value="finalizada">Finalizada</option>
          <option value="anulada">Anulada</option>
        </select>

        <div className="grid grid-cols-2 gap-2">
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        <div className="flex gap-2 md:col-span-4">
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Filtrar
          </button>

          <Link
            href="/dashboard/production/campaigns"
            className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Limpiar filtros
          </Link>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Campanias registradas</p>
          <p className="mt-2 text-3xl font-bold">{campaigns.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Planificadas o activas</p>
          <p className="mt-2 text-3xl font-bold">{activeCampaigns.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Objetivo total</p>
          <p className="mt-2 text-3xl font-bold">{totalTarget.toFixed(2)}</p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Producido total</p>
          <p className="mt-2 text-3xl font-bold">{totalProduced.toFixed(2)}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Codigo</th>
              <th className="px-4 py-3 font-semibold">Campania</th>
              <th className="px-4 py-3 font-semibold">Fechas</th>
              <th className="px-4 py-3 font-semibold">Productos</th>
              <th className="px-4 py-3 font-semibold">Objetivo</th>
              <th className="px-4 py-3 font-semibold">Producido</th>
              <th className="px-4 py-3 font-semibold">Ordenes</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {campaigns.map((campaign) => {
              const campaignTarget = campaign.campania_detalle.reduce(
                (total, detail) => total + toNumber(detail.cantidad_objetivo),
                0,
              );
              const campaignProduced = campaign.campania_detalle.reduce(
                (total, detail) => total + toNumber(detail.cantidad_producida),
                0,
              );

              return (
                <tr key={campaign.id_campania} className="border-t">
                  <td className="px-4 py-3 font-mono text-xs">
                    {campaign.id_campania}
                  </td>

                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {campaign.nombre_campania}
                    </div>

                    {campaign.objetivo_general ? (
                      <p className="mt-1 max-w-sm text-xs text-slate-500">
                        {campaign.objetivo_general}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    <div>Inicio: {formatDate(campaign.fecha_inicio)}</div>
                    <p className="mt-1 text-xs text-slate-500">
                      Fin: {formatDate(campaign.fecha_fin)}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    {campaign._count.campania_detalle}
                  </td>

                  <td className="px-4 py-3">
                    {formatDecimal(campaignTarget)}
                  </td>

                  <td className="px-4 py-3">
                    {formatDecimal(campaignProduced)}
                  </td>

                  <td className="px-4 py-3">
                    {campaign._count.orden_trabajo}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
                        campaign.estado,
                      )}`}
                    >
                      {campaign.estado}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/dashboard/production/campaigns/${campaign.id_campania}`}
                        className="text-sm font-medium text-slate-600 hover:text-slate-950"
                      >
                        Ver detalle
                      </Link>

                      {campaign.estado !== "anulada" ? (
                        <Link
                          href={`/dashboard/production/campaigns/${campaign.id_campania}/edit`}
                          className="text-sm font-medium text-slate-600 hover:text-slate-950"
                        >
                          Editar
                        </Link>
                      ) : null}

                      {campaign.estado === "planificada" ? (
                        <form action={changeProductionCampaignStatusAction}>
                          <input
                            type="hidden"
                            name="id_campania"
                            value={campaign.id_campania}
                          />
                          <input type="hidden" name="estado" value="activa" />
                          <button
                            type="submit"
                            className="text-left text-sm font-medium text-slate-600 hover:text-slate-950"
                          >
                            Activar
                          </button>
                        </form>
                      ) : null}

                      {campaign.estado === "activa" ? (
                        <form action={changeProductionCampaignStatusAction}>
                          <input
                            type="hidden"
                            name="id_campania"
                            value={campaign.id_campania}
                          />
                          <input
                            type="hidden"
                            name="estado"
                            value="finalizada"
                          />
                          <button
                            type="submit"
                            className="text-left text-sm font-medium text-slate-600 hover:text-slate-950"
                          >
                            Finalizar
                          </button>
                        </form>
                      ) : null}

                      {!["anulada", "finalizada"].includes(campaign.estado) ? (
                        <form action={changeProductionCampaignStatusAction}>
                          <input
                            type="hidden"
                            name="id_campania"
                            value={campaign.id_campania}
                          />
                          <input type="hidden" name="estado" value="anulada" />
                          <button
                            type="submit"
                            className="text-left text-sm font-medium text-red-600 hover:text-red-700"
                          >
                            Anular
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}

            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Todavia no hay campanias de produccion registradas.
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
          Volver al modulo de produccion
        </Link>
      </div>
    </main>
  );
}
