import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
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
      <PageHeader
        title="Costos y rentabilidad"
        description="Controla costeos de producción, costos indirectos, márgenes, precios sugeridos, precios finales, utilidad estimada y alertas de bajo margen."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Costos" }])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={navigationHrefs.costings}>Ver costeos</Link>
            </Button>

            <Button asChild>
              <Link href={navigationHrefs.costWorkOrders}>
                Generar costeo
              </Link>
            </Button>
          </>
        }
      />

      <Alert variant={moduleReady ? "success" : "warning"}>
        <AlertDescription>
          <span className="font-medium text-foreground">
            {moduleReady
              ? "Módulo de costos operativo"
              : "Módulo de costos pendiente de datos"}
          </span>
          <span className="mt-1 block">
            {moduleReady
              ? "El módulo ya cuenta con información económica para gestionar costeos, márgenes y rentabilidad."
              : "Para iniciar, crea órdenes de trabajo con receta técnica y luego genera su costeo."}
          </span>
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Costeos registrados" value={totalCostings.toString()} description={`${costingsThisMonth} generados este mes`} tone="info" />
        <KpiCard title="Costo acumulado" value={formatMoney(totalCostAmount._sum.costo_total)} description={`Promedio: ${formatMoney(averageCost)}`} tone="info" />
        <KpiCard title="Costos indirectos" value={formatMoney(totalIndirectCosts._sum.monto)} description="Gastos agregados a costeos." tone="warning" />
        <KpiCard title="Alertas de bajo margen" value={lowMarginAlerts.toString()} description="Rentabilidades críticas." tone="warning" />
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Órdenes activas" value={workOrdersTotal.toString()} description="No anuladas." tone="info" />
        <KpiCard title="Órdenes sin receta" value={workOrdersWithoutRecipe.toString()} description="No pueden costearse aún." tone="warning" />
        <KpiCard title="Órdenes pendientes de costeo" value={workOrdersWithoutCosting.toString()} description="Con receta y sin costeo." tone="warning" />
        <KpiCard title="Rentabilidades calculadas" value={profitabilityCalculations.toString()} description="Márgenes reales evaluados." tone="success" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <CardTitle className="text-base">Últimos costeos</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Resumen de los registros económicos más recientes.
                </p>
              </div>

              <Button variant="link" className="h-auto p-0" asChild>
                <Link href="/dashboard/costs/costings">Ver todos</Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {latestCostings.length === 0 ? (
              <EmptyState label="Aún no hay costeos registrados. Genera uno desde una orden de trabajo con receta técnica." />
            ) : (
              <div className="divide-y divide-border/70">
                {latestCostings.map((item) => {
                  const latestMargin = item.margen_ganancia[0];
                  const latestProfitability = item.rentabilidad[0];

                  const sourceLabel = item.orden_trabajo
                    ? `${item.orden_trabajo.id_orden_trabajo} | ${item.orden_trabajo.producto.nombre_producto}`
                    : item.pedido
                      ? `${item.pedido.id_pedido} | ${item.pedido.cliente.nombre_razon_social}`
                      : "Costeo manual";

                  return (
                    <div
                      key={item.id_costeo}
                      className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center"
                    >
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {item.id_costeo} | {formatDate(item.fecha_costeo)}
                        </p>

                        <p className="font-medium text-foreground">
                          {sourceLabel}
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          Costo total: {formatMoney(item.costo_total)} | Margen:{" "}
                          {latestMargin
                            ? formatPercent(latestMargin.porcentaje_margen)
                            : "Pendiente"}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {latestProfitability ? (
                          <Badge
                            variant={
                              latestProfitability.alerta_bajo_margen
                                ? "destructive"
                                : "success"
                            }
                          >
                            {latestProfitability.alerta_bajo_margen
                              ? "Margen bajo"
                              : "Rentable"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pendiente</Badge>
                        )}

                        <Button variant="link" className="h-auto p-0" asChild>
                          <Link href={`/dashboard/costs/costings/${item.id_costeo}`}>
                            Detalle
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertas recientes</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Costeos con bajo margen de rentabilidad.
            </p>
          </CardHeader>

          <CardContent>
            {latestLowMarginCostings.length === 0 ? (
              <EmptyState label="No hay alertas de bajo margen registradas." />
            ) : (
              <div className="divide-y divide-border/70">
                {latestLowMarginCostings.map((item) => {
                  const latestProfitability = item.rentabilidad[0];

                  const sourceLabel = item.orden_trabajo
                    ? `${item.orden_trabajo.id_orden_trabajo} | ${item.orden_trabajo.producto.nombre_producto}`
                    : item.pedido
                      ? `${item.pedido.id_pedido} | ${item.pedido.cliente.nombre_razon_social}`
                      : "Costeo manual";

                  return (
                    <div key={item.id_costeo} className="py-4 first:pt-0 last:pb-0">
                      <p className="text-xs text-muted-foreground">
                        {item.id_costeo}
                      </p>

                      <p className="mt-1 font-medium text-foreground">
                        {sourceLabel}
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Margen real:{" "}
                        {latestProfitability
                          ? formatPercent(latestProfitability.margen_real)
                          : "-"}
                      </p>

                      <Button
                        variant="link"
                        className="mt-2 h-auto p-0 text-destructive hover:text-destructive"
                        asChild
                      >
                        <Link href={`/dashboard/costs/costings/${item.id_costeo}`}>
                          Revisar alerta
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
