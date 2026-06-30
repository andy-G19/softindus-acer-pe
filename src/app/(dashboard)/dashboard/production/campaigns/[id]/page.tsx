import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

type ProductionCampaignDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
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
  if (status === "activa" || status === "finalizada") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "planificada") {
    return "bg-blue-50 text-blue-700";
  }

  if (status === "anulada") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default async function ProductionCampaignDetailPage({
  params,
}: ProductionCampaignDetailPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  requireProductionAccess(session.user.role);

  const { id } = await params;

  const campaign = await prisma.campania_produccion.findUnique({
    where: {
      id_campania: id,
    },
    include: {
      campania_detalle: {
        include: {
          producto: true,
        },
        orderBy: {
          id_campania_detalle: "asc",
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
        },
        orderBy: {
          fecha_registro: "desc",
        },
        take: 8,
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  const canAddDetails = !["finalizada", "anulada"].includes(campaign.estado);
  const totalTarget = campaign.campania_detalle.reduce(
    (total, detail) => total + toNumber(detail.cantidad_objetivo),
    0,
  );
  const totalProduced = campaign.campania_detalle.reduce(
    (total, detail) => total + toNumber(detail.cantidad_producida),
    0,
  );
  const pendingProduction = Math.max(totalTarget - totalProduced, 0);
  const progress =
    totalTarget > 0 ? Math.min((totalProduced / totalTarget) * 100, 100) : 0;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Produccion · Campanias · Detalle
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            {campaign.nombre_campania}
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            {campaign.objetivo_general ?? "Campania sin objetivo general."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClass(
                campaign.estado,
              )}`}
            >
              {campaign.estado}
            </span>

            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              Inicio: {formatDate(campaign.fecha_inicio)}
            </span>

            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
              Fin: {formatDate(campaign.fecha_fin)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canAddDetails ? (
            <Link
              href={`/dashboard/production/campaigns/${campaign.id_campania}/details/new`}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Agregar producto
            </Link>
          ) : null}

          <Link
            href="/dashboard/production/work-orders/new"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Crear orden
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Productos</p>
          <p className="mt-2 text-3xl font-bold">
            {campaign.campania_detalle.length}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Cantidad objetivo</p>
          <p className="mt-2 text-3xl font-bold">
            {formatDecimal(totalTarget)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Cantidad producida</p>
          <p className="mt-2 text-3xl font-bold">
            {formatDecimal(totalProduced)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendiente estimado</p>
          <p className="mt-2 text-3xl font-bold">
            {formatDecimal(pendingProduction)}
          </p>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Avance general</h2>
            <p className="text-sm text-slate-500">
              Calculado con las cantidades producidas registradas por producto.
            </p>
          </div>

          <span className="text-sm font-medium text-slate-700">
            {progress.toFixed(2)}%
          </span>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      {!canAddDetails ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Esta campania esta finalizada o anulada. No se pueden agregar nuevos
          productos.
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-xl font-semibold">Productos de la campania</h2>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Categoria</th>
              <th className="px-4 py-3 font-semibold">Unidad</th>
              <th className="px-4 py-3 font-semibold">Objetivo</th>
              <th className="px-4 py-3 font-semibold">Producido</th>
              <th className="px-4 py-3 font-semibold">Pendiente</th>
              <th className="px-4 py-3 font-semibold">Observaciones</th>
            </tr>
          </thead>

          <tbody>
            {campaign.campania_detalle.map((detail) => {
              const target = toNumber(detail.cantidad_objetivo);
              const produced = toNumber(detail.cantidad_producida);

              return (
                <tr key={detail.id_campania_detalle} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {detail.producto.nombre_producto}
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {detail.id_campania_detalle}
                    </p>
                  </td>

                  <td className="px-4 py-3 capitalize">
                    {detail.producto.categoria}
                  </td>

                  <td className="px-4 py-3">
                    {detail.producto.unidad_medida}
                  </td>

                  <td className="px-4 py-3">{formatDecimal(target)}</td>

                  <td className="px-4 py-3">{formatDecimal(produced)}</td>

                  <td className="px-4 py-3">
                    {formatDecimal(Math.max(target - produced, 0))}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {detail.observaciones ?? "-"}
                  </td>
                </tr>
              );
            })}

            {campaign.campania_detalle.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Esta campania todavia no tiene productos registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="text-xl font-semibold">Ordenes asociadas</h2>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">Codigo</th>
              <th className="px-4 py-3 font-semibold">Producto</th>
              <th className="px-4 py-3 font-semibold">Cantidad</th>
              <th className="px-4 py-3 font-semibold">Inicio</th>
              <th className="px-4 py-3 font-semibold">Estado</th>
              <th className="px-4 py-3 font-semibold">Accion</th>
            </tr>
          </thead>

          <tbody>
            {campaign.orden_trabajo.map((order) => (
              <tr key={order.id_orden_trabajo} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">
                  {order.id_orden_trabajo}
                </td>

                <td className="px-4 py-3">
                  {order.producto.nombre_producto}
                </td>

                <td className="px-4 py-3">
                  {formatDecimal(order.cantidad)} {order.producto.unidad_medida}
                </td>

                <td className="px-4 py-3">{formatDate(order.fecha_inicio)}</td>

                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {order.estado}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/production/work-orders/${order.id_orden_trabajo}`}
                    className="text-sm font-medium text-slate-600 hover:text-slate-950"
                  >
                    Ver orden
                  </Link>
                </td>
              </tr>
            ))}

            {campaign.orden_trabajo.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No hay ordenes de trabajo asociadas a esta campania.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <div>
        <Link
          href="/dashboard/production/campaigns"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Volver a campanias
        </Link>
      </div>
    </main>
  );
}
