import { Ban, ClipboardList, Clock, FlaskConical } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/navigation/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { createCostingFromWorkOrderAction } from "@/modules/costs/costings/actions";

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(value);
}

function getOrderBadgeVariant(status: string) {
  if (status === "finalizada") {
    return "success" as const;
  }

  if (status === "en_proceso") {
    return "info" as const;
  }

  if (status === "pausada") {
    return "warning" as const;
  }

  if (status === "anulada") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export default async function CostingWorkOrdersPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const [
    workOrdersWithoutCosting,
    latestCostings,
    totalWorkOrders,
    workOrdersWithoutRecipe,
    workOrdersAlreadyCosted,
    anulledWorkOrders,
  ] = await Promise.all([
    prisma.orden_trabajo.findMany({
      where: {
        estado: {
          not: "anulada",
        },
        id_version_receta: {
          not: null,
        },
        version_receta: {
          estado: {
            not: "anulada",
          },
        },
        costeo: {
          none: {},
        },
      },
      include: {
        producto: true,
        cliente: true,
        campania_produccion: true,
        ruta_fabricacion: true,
        detalle_pedido: {
          include: {
            pedido: {
              include: {
                cliente: true,
              },
            },
          },
        },
        version_receta: {
          include: {
            receta_tecnica: true,
            _count: {
              select: {
                detalle_receta: true,
              },
            },
          },
        },
      },
      orderBy: {
        fecha_registro: "desc",
      },
    }),

    prisma.costeo.findMany({
      take: 5,
      orderBy: {
        fecha_costeo: "desc",
      },
      include: {
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
        pedido: {
          include: {
            cliente: true,
          },
        },
      },
    }),

    prisma.orden_trabajo.count(),

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
        costeo: {
          some: {},
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "anulada",
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Generar costeo desde producción"
        description="Selecciona una orden de trabajo con versión de receta registrada para calcular automáticamente el costo estimado de materiales y consumibles."
        backHref={navigationHrefs.costs}
        backLabel="Volver a costos"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Costos", href: navigationHrefs.costs },
          { label: "Órdenes de trabajo" },
        ])}
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/costs/costings">Ver costeos</Link>
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Órdenes pendientes" value={workOrdersWithoutCosting.length.toString()} description="Con receta y sin costeo." tone="warning" icon={Clock} />
        <KpiCard title="Total de órdenes" value={totalWorkOrders.toString()} description="Incluye activas y anuladas." tone="info" icon={ClipboardList} />
        <KpiCard title="Sin receta técnica" value={workOrdersWithoutRecipe.toString()} description="Deben completarse en producción." tone="warning" icon={FlaskConical} />
        <KpiCard title="Ya costeadas / anuladas" value={`${workOrdersAlreadyCosted} / ${anulledWorkOrders}`} description="No aparecen como pendientes." tone="info" icon={Ban} />
      </section>

      {workOrdersWithoutCosting.length === 0 ? (
        <Alert variant="warning">
          <AlertDescription>
            <span className="font-medium text-foreground">
              No hay órdenes disponibles para costeo
            </span>
            <span className="mt-1 block">
              Esto puede ocurrir porque no existen órdenes de trabajo, porque
              las órdenes no tienen receta técnica, porque ya fueron
              costeadas o porque están anuladas.
            </span>
            <span className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/production/work-orders">
                  Revisar órdenes de producción
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/production/recipes">
                  Revisar recetas técnicas
                </Link>
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Órdenes disponibles para costeo
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Solo se muestran órdenes no anuladas, con versión de receta y sin
            costeo previo.
          </p>
        </CardHeader>

        <CardContent className="px-0">
          {workOrdersWithoutCosting.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No hay órdenes pendientes de costeo."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Receta</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {workOrdersWithoutCosting.map((order) => {
                  const origin =
                    order.tipo_produccion === "pedido"
                      ? order.detalle_pedido?.pedido.cliente
                          .nombre_razon_social ??
                        order.cliente?.nombre_razon_social ??
                        "Pedido"
                      : order.tipo_produccion === "campania"
                        ? order.campania_produccion?.nombre_campania ??
                          "Campaña"
                        : "Reposición de stock";

                  const recipeDetailCount =
                    order.version_receta?._count.detalle_receta ?? 0;

                  const canGenerateCosting = recipeDetailCount > 0;

                  return (
                    <TableRow key={order.id_orden_trabajo}>
                      <TableCell className="text-xs">
                        {order.id_orden_trabajo}
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">
                          {order.producto.nombre_producto}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {order.producto.categoria}
                        </p>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">{origin}</div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Tipo: {order.tipo_produccion}
                        </p>
                      </TableCell>

                      <TableCell>
                        {formatDecimal(order.cantidad)}{" "}
                        {order.producto.unidad_medida}
                      </TableCell>

                      <TableCell>
                        {order.version_receta ? (
                          <>
                            <div>
                              {order.version_receta.receta_tecnica.nombre_receta}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Versión: {order.version_receta.numero_version} ·{" "}
                              Materiales: {recipeDetailCount}
                            </p>
                          </>
                        ) : (
                          "-"
                        )}
                      </TableCell>

                      <TableCell>{formatDate(order.fecha_inicio)}</TableCell>

                      <TableCell>
                        <Badge variant={getOrderBadgeVariant(order.estado)}>
                          {order.estado}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        {canGenerateCosting ? (
                          <form action={createCostingFromWorkOrderAction}>
                            <input
                              type="hidden"
                              name="id_orden_trabajo"
                              value={order.id_orden_trabajo}
                            />
                            <Button type="submit" size="sm">
                              Generar costeo
                            </Button>
                          </form>
                        ) : (
                          <span className="text-xs text-destructive">
                            Sin materiales
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Costeos recientes</CardTitle>
          <p className="text-sm text-muted-foreground">
            Últimos costeos generados desde órdenes de trabajo o pedidos.
          </p>
        </CardHeader>

        <CardContent>
          {latestCostings.length === 0 ? (
            <EmptyState label="Todavía no hay costeos registrados." />
          ) : (
            <div className="divide-y divide-border/70">
              {latestCostings.map((costing) => {
                const source = costing.orden_trabajo
                  ? `${costing.orden_trabajo.id_orden_trabajo} · ${costing.orden_trabajo.producto.nombre_producto}`
                  : costing.pedido
                    ? `${costing.pedido.id_pedido} · ${costing.pedido.cliente.nombre_razon_social}`
                    : "Costeo manual";

                return (
                  <div
                    key={costing.id_costeo}
                    className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center"
                  >
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {costing.id_costeo}
                      </p>
                      <p className="font-medium text-foreground">{source}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Costo total: S/ {toNumber(costing.costo_total).toFixed(2)}
                      </p>
                    </div>

                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link href={`/dashboard/costs/costings/${costing.id_costeo}`}>
                        Ver detalle
                      </Link>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
