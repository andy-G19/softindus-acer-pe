import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

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

export default async function ProductionCampaignsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const campaigns = await prisma.campania_produccion.findMany({
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
  });

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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Produccion · Campanias
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Campanias de produccion
          </h1>

          <p className="max-w-3xl text-slate-600">
            Planifica lotes de produccion por campania y consulta el avance por
            producto.
          </p>
        </div>

        <Link
          href="/dashboard/production/campaigns/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Nueva campania
        </Link>
      </section>

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
              <th className="px-4 py-3 font-semibold">Accion</th>
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
                    <Link
                      href={`/dashboard/production/campaigns/${campaign.id_campania}`}
                      className="text-sm font-medium text-slate-600 hover:text-slate-950"
                    >
                      Ver detalle
                    </Link>
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
