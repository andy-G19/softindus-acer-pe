import {
  AlertTriangle,
  ClipboardList,
  CircleDollarSign,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type CostingsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatPercent(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${toNumber(value).toFixed(2)}%`;
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function getOriginTypeLabel(type: string | null | undefined) {
  if (type === "pedido") {
    return "Pedido";
  }

  if (type === "campania") {
    return "Campaña";
  }

  if (type === "stock") {
    return "Stock";
  }

  return "Manual";
}

export default async function CostingsPage({
  searchParams,
}: CostingsPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const pedido = parseStringParam(params, "pedido");
  const orden = parseStringParam(params, "orden");
  const producto = parseStringParam(params, "producto");
  const estado = parseStringParam(params, "estado");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );

  const filters: Prisma.costeoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_costeo: { contains: q, mode: "insensitive" } },
        { id_pedido: { contains: q, mode: "insensitive" } },
        { id_orden_trabajo: { contains: q, mode: "insensitive" } },
        {
          pedido: {
            cliente: {
              nombre_razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
        {
          orden_trabajo: {
            producto: {
              nombre_producto: { contains: q, mode: "insensitive" },
            },
          },
        },
        {
          orden_trabajo: {
            cliente: {
              nombre_razon_social: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (pedido) {
    filters.push({ id_pedido: { contains: pedido, mode: "insensitive" } });
  }

  if (orden) {
    filters.push({
      id_orden_trabajo: { contains: orden, mode: "insensitive" },
    });
  }

  if (producto) {
    filters.push({
      orden_trabajo: {
        producto: {
          nombre_producto: { contains: producto, mode: "insensitive" },
        },
      },
    });
  }

  if (dateRange) {
    filters.push({ fecha_costeo: dateRange });
  }

  if (estado === "pendiente") {
    filters.push({ rentabilidad: { none: {} } });
  }

  if (estado === "rentable") {
    filters.push({ rentabilidad: { some: { alerta_bajo_margen: false } } });
  }

  if (estado === "margen_bajo") {
    filters.push({ rentabilidad: { some: { alerta_bajo_margen: true } } });
  }

  const where: Prisma.costeoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const costings = await prisma.costeo.findMany({
    where,
    orderBy: {
      fecha_costeo: "desc",
    },
    take: 50,
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
          campania_produccion: true,
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
  });

  const totalCostings = await prisma.costeo.count({ where });

  const accumulatedCost = costings.reduce((total, item) => {
    return total + toNumber(item.costo_total);
  }, 0);

  const accumulatedProfit = costings.reduce((total, item) => {
    const latestProfitability = item.rentabilidad[0];

    if (!latestProfitability) {
      return total;
    }

    return total + toNumber(latestProfitability.utilidad_estimada);
  }, 0);

  const lowMarginCount = costings.filter((item) => {
    const latestProfitability = item.rentabilidad[0];

    return latestProfitability?.alerta_bajo_margen === true;
  }).length;

  return (
    <main className="space-y-6">
      <PageHeader
        title="Costeos"
        description="Consulta los costeos generados, su origen productivo o comercial, el costo total, margen aplicado, precio final y rentabilidad estimada."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Costos", href: navigationHrefs.costs },
          { label: "Costeos" },
        ])}
        actions={
          <Button variant="outline" asChild>
            <Link href={navigationHrefs.costWorkOrders}>Generar costeo</Link>
          </Button>
        }
      />

      <form className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-3 xl:grid-cols-7">
        <div className="space-y-2">
          <Label htmlFor="q">Buscar</Label>
          <Input id="q" name="q" defaultValue={q} placeholder="Costeo, cliente, pedido" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pedido">Pedido</Label>
          <Input id="pedido" name="pedido" defaultValue={pedido} placeholder="Pedido" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="orden">Orden de trabajo</Label>
          <Input id="orden" name="orden" defaultValue={orden} placeholder="Orden de trabajo" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="producto">Producto</Label>
          <Input id="producto" name="producto" defaultValue={producto} placeholder="Producto" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="from">Desde</Label>
          <Input id="from" name="from" type="date" defaultValue={parseStringParam(params, "from")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Hasta</Label>
          <Input id="to" name="to" type="date" defaultValue={parseStringParam(params, "to")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estado">Estado</Label>
          <NativeSelect id="estado" name="estado" defaultValue={estado}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="rentable">Rentable</option>
            <option value="margen_bajo">Margen bajo</option>
          </NativeSelect>
        </div>
        <div className="flex items-end gap-2 md:col-span-3 xl:col-span-7">
          <Button type="submit">Filtrar</Button>
          <Button variant="clear" asChild>
            <Link href="/dashboard/costs/costings">Limpiar filtros</Link>
          </Button>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Costeos listados" value={totalCostings.toString()} description="Últimos 50 registros." tone="info" icon={ClipboardList} />
        <KpiCard title="Costo acumulado" value={formatMoney(accumulatedCost)} description="Suma de costos totales." tone="info" icon={CircleDollarSign} />
        <KpiCard title="Utilidad acumulada" value={formatMoney(accumulatedProfit)} description="Según rentabilidades calculadas." tone="success" icon={TrendingUp} />
        <KpiCard title="Alertas de bajo margen" value={lowMarginCount.toString()} description="Rentabilidad crítica." tone="warning" icon={AlertTriangle} />
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Costeo</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Cliente / Pedido</TableHead>
            <TableHead>Cantidad</TableHead>
            <TableHead>Costo total</TableHead>
            <TableHead>Margen</TableHead>
            <TableHead>Precio final</TableHead>
            <TableHead>Utilidad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acción</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {costings.map((costing) => {
            const workOrder = costing.orden_trabajo;
            const latestMargin = costing.margen_ganancia[0];
            const latestProfitability = costing.rentabilidad[0];

            const originType = workOrder
              ? getOriginTypeLabel(workOrder.tipo_produccion)
              : costing.pedido
                ? "Pedido"
                : "Manual";

            const originMain = workOrder
              ? `${workOrder.id_orden_trabajo} | ${workOrder.producto.nombre_producto}`
              : costing.pedido
                ? costing.pedido.id_pedido
                : "Costeo manual";

            const originSecondary = workOrder
              ? `Producto: ${workOrder.producto.categoria}`
              : costing.pedido
                ? `Pedido comercial`
                : "Sin origen asociado";

            const clientName =
              workOrder?.detalle_pedido?.pedido.cliente.nombre_razon_social ??
              workOrder?.cliente?.nombre_razon_social ??
              costing.pedido?.cliente.nombre_razon_social ??
              "-";

            const orderOrPedidoId =
              workOrder?.detalle_pedido?.id_pedido ??
              costing.pedido?.id_pedido ??
              "-";

            const priceFinal =
              latestMargin?.precio_final ??
              latestMargin?.precio_sugerido ??
              null;

            return (
              <TableRow key={costing.id_costeo}>
                <TableCell>
                  <div className="text-xs font-medium">
                    {costing.id_costeo}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(costing.fecha_costeo)}
                  </p>
                </TableCell>

                <TableCell>
                  <div className="font-medium">{originMain}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {originType} · {originSecondary}
                  </p>
                </TableCell>

                <TableCell>
                  <div className="font-medium">{clientName}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pedido: {orderOrPedidoId}
                  </p>
                </TableCell>

                <TableCell>{formatDecimal(costing.cantidad_base)}</TableCell>

                <TableCell>{formatMoney(costing.costo_total)}</TableCell>

                <TableCell>
                  {latestMargin
                    ? formatPercent(latestMargin.porcentaje_margen)
                    : "-"}
                </TableCell>

                <TableCell>
                  {priceFinal ? formatMoney(priceFinal) : "-"}
                </TableCell>

                <TableCell>
                  {latestProfitability
                    ? formatMoney(latestProfitability.utilidad_estimada)
                    : "-"}
                </TableCell>

                <TableCell>
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
                </TableCell>

                <TableCell>
                  <Button variant="link" className="h-auto p-0" asChild>
                    <Link href={`/dashboard/costs/costings/${costing.id_costeo}`}>
                      Ver detalle
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}

          {costings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="p-0">
                <EmptyState
                  className="border-0"
                  label="Todavía no hay costeos registrados. Puedes generar uno desde una orden de trabajo."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
