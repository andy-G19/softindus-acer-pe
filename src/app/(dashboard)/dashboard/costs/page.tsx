import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/db";

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
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

function formatPercent(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${toNumber(value).toFixed(2)}%`;
}

function getProfitabilityStatusLabel(alert: boolean) {
  return alert ? "Margen bajo" : "Rentable";
}

function getProfitabilityStatusClass(alert: boolean) {
  return alert
    ? "bg-red-50 text-red-700"
    : "bg-emerald-50 text-emerald-700";
}

export default async function CostsDashboardPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [
    totalCostings,
    costingsThisMonth,
    totalCostAmount,
    totalIndirectCosts,
    marginsApplied,
    profitabilityCalculations,
    lowMarginAlerts,
    workOrdersTotal,
    workOrdersWithoutRecipe,
    workOrdersWithoutCosting,
    latestCostings,
    latestLowMarginCostings,
  ] = await Promise.all([
    prisma.costeo.count(),

    prisma.costeo.count({
      where: {
        fecha_costeo: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.costeo.aggregate({
      _sum: {
        costo_total: true,
      },
    }),

    prisma.costo_indirecto.aggregate({
      _sum: {
        monto: true,
      },
    }),

    prisma.margen_ganancia.count(),

    prisma.rentabilidad.count(),

    prisma.rentabilidad.count({
      where: {
        alerta_bajo_margen: true,
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          not: "anulada",
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          not: "anulada",
        },
        id_version_receta: null,
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          not: "anulada",
        },
        id_version_receta: {
          not: null,
        },
        costeo: {
          none: {},
        },
      },
    }),

    prisma.costeo.findMany({
      orderBy: {
        fecha_costeo: "desc",
      },
      take: 6,
      include: {
        pedido: {
          include: {
            cliente: true,
          },
        },
        orden_trabajo: {
          include: {
            producto: true,
            cliente: true,
            detalle_pedido: {
              include: {
                pedido: {
                  include: {
                    cliente: true,
                  },
                },
              },
            },
          },
        },
        margen_ganancia: {
          orderBy: {
            fecha_aplicacion: "desc",
          },
          take: 1,
        },
        rentabilidad: {
          orderBy: {
            fecha_calculo: "desc",
          },
          take: 1,
        },
      },
    }),

    prisma.costeo.findMany({
      where: {
        rentabilidad: {
          some: {
            alerta_bajo_margen: true,
          },
        },
      },
      orderBy: {
        fecha_costeo: "desc",
      },
      take: 5,
      include: {
        pedido: {
          include: {
            cliente: true,
          },
        },
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
        rentabilidad: {
          where: {
            alerta_bajo_margen: true,
          },
          orderBy: {
            fecha_calculo: "desc",
          },
          take: 1,
        },
      },
    }),
  ]);

  const totalCost = toNumber(totalCostAmount._sum.costo_total);
  const averageCost = totalCostings > 0 ? totalCost / totalCostings : 0;

  const moduleReady =
    totalCostings > 0 ||
    workOrdersWithoutCosting > 0 ||
    marginsApplied > 0 ||
    profitabilityCalculations > 0;

  return (
    <main className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Costos y rentabilidad
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Módulo Costos y Rentabilidad
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Controla costeos de producción, costos indirectos, márgenes,
            precios sugeridos, precios finales, utilidad estimada y alertas de
            bajo margen.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/costs/costings"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Ver costeos
          </Link>

          <Link
            href="/dashboard/costs/work-orders"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Generar costeo
          </Link>
        </div>
      </section>

      <section
        className={`rounded-xl border p-5 text-sm ${
          moduleReady
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        <p className="font-semibold">
          {moduleReady
            ? "✅ Módulo de costos operativo"
            : "⚠️ Módulo de costos pendiente de datos"}
        </p>

        <p className="mt-1">
          {moduleReady
            ? "El módulo ya cuenta con información económica para gestionar costeos, márgenes y rentabilidad."
            : "Para iniciar, crea órdenes de trabajo con receta técnica y luego genera su costeo."}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Costeos registrados
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{totalCostings}</p>
            <p className="mt-1 text-xs text-slate-500">
              {costingsThisMonth} generados este mes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Costo acumulado
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">
              {formatMoney(totalCostAmount._sum.costo_total)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Promedio: {formatMoney(averageCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Costos indirectos
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">
              {formatMoney(totalIndirectCosts._sum.monto)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Gastos agregados a costeos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Alertas de bajo margen
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{lowMarginAlerts}</p>
            <p className="mt-1 text-xs text-slate-500">
              Rentabilidades críticas
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Órdenes activas
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{workOrdersTotal}</p>
            <p className="mt-1 text-xs text-slate-500">
              No anuladas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Órdenes sin receta
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{workOrdersWithoutRecipe}</p>
            <p className="mt-1 text-xs text-slate-500">
              No pueden costearse aún
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Órdenes pendientes de costeo
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{workOrdersWithoutCosting}</p>
            <p className="mt-1 text-xs text-slate-500">
              Con receta y sin costeo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Rentabilidades calculadas
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-3xl font-bold">{profitabilityCalculations}</p>
            <p className="mt-1 text-xs text-slate-500">
              Márgenes reales evaluados
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-xl border bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b p-5 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold">Últimos costeos</h2>
              <p className="mt-1 text-sm text-slate-500">
                Resumen de los registros económicos más recientes.
              </p>
            </div>

            <Link
              href="/dashboard/costs/costings"
              className="text-sm font-medium text-slate-700 hover:text-slate-950"
            >
              Ver todos →
            </Link>
          </div>

          {latestCostings.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              Aún no hay costeos registrados. Genera uno desde una orden de
              trabajo con receta técnica.
            </div>
          ) : (
            <div className="divide-y">
              {latestCostings.map((item) => {
                const latestMargin = item.margen_ganancia[0];
                const latestProfitability = item.rentabilidad[0];

                const sourceLabel = item.orden_trabajo
                  ? `${item.orden_trabajo.id_orden_trabajo} · ${item.orden_trabajo.producto.nombre_producto}`
                  : item.pedido
                    ? `${item.pedido.id_pedido} · ${item.pedido.cliente.nombre_razon_social}`
                    : "Costeo manual";

                return (
                  <div
                    key={item.id_costeo}
                    className="flex flex-col justify-between gap-3 p-5 md:flex-row md:items-center"
                  >
                    <div>
                      <p className="font-mono text-xs text-slate-500">
                        {item.id_costeo} · {formatDate(item.fecha_costeo)}
                      </p>

                      <p className="font-medium">{sourceLabel}</p>

                      <p className="mt-1 text-sm text-slate-500">
                        Costo total: {formatMoney(item.costo_total)} · Margen:{" "}
                        {latestMargin
                          ? formatPercent(latestMargin.porcentaje_margen)
                          : "Pendiente"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {latestProfitability ? (
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${getProfitabilityStatusClass(
                            latestProfitability.alerta_bajo_margen,
                          )}`}
                        >
                          {getProfitabilityStatusLabel(
                            latestProfitability.alerta_bajo_margen,
                          )}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          Pendiente
                        </span>
                      )}

                      <Link
                        href={`/dashboard/costs/costings/${item.id_costeo}`}
                        className="text-sm font-medium text-slate-700 hover:text-slate-950"
                      >
                        Detalle →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">Alertas recientes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Costeos con bajo margen de rentabilidad.
            </p>
          </div>

          {latestLowMarginCostings.length === 0 ? (
            <div className="p-5 text-sm text-slate-500">
              No hay alertas de bajo margen registradas.
            </div>
          ) : (
            <div className="divide-y">
              {latestLowMarginCostings.map((item) => {
                const latestProfitability = item.rentabilidad[0];

                const sourceLabel = item.orden_trabajo
                  ? `${item.orden_trabajo.id_orden_trabajo} · ${item.orden_trabajo.producto.nombre_producto}`
                  : item.pedido
                    ? `${item.pedido.id_pedido} · ${item.pedido.cliente.nombre_razon_social}`
                    : "Costeo manual";

                return (
                  <div key={item.id_costeo} className="p-5">
                    <p className="font-mono text-xs text-slate-500">
                      {item.id_costeo}
                    </p>

                    <p className="mt-1 font-medium">{sourceLabel}</p>

                    <p className="mt-1 text-sm text-slate-500">
                      Margen real:{" "}
                      {latestProfitability
                        ? formatPercent(latestProfitability.margen_real)
                        : "-"}
                    </p>

                    <Link
                      href={`/dashboard/costs/costings/${item.id_costeo}`}
                      className="mt-3 inline-block text-sm font-medium text-red-700 hover:text-red-900"
                    >
                      Revisar alerta →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        <p className="font-semibold">Fase 5.7 implementada</p>

        <p className="mt-1">
          El módulo de costos queda consolidado con dashboard, generación de
          costeos, costos indirectos, márgenes, precios, rentabilidad, alertas y
          navegación final del módulo.
        </p>
      </section>
    </main>
  );
}