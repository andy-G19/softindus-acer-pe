import {
  AlertTriangle,
  ClipboardList,
  CircleDollarSign,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
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
import { formatDate, formatMoney } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import {
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { getCostingListData } from "@/modules/costs/costings/queries";

type CostingsPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function formatDecimal(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatPercent(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${toNumber(value).toFixed(2)}%`;
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
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");

  const { costings, totalCostings } = await getCostingListData({
    q,
    pedido,
    orden,
    producto,
    estado,
    from,
    to,
  });

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
    <div className="space-y-6">
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

      <FilterBar action={navigationHrefs.costings} label="Filtros de costeos" clearHref={navigationHrefs.costings}>
        <Field id="q" label="Buscar">
          {(control) => <Input {...control} name="q" defaultValue={q} placeholder="Costeo, cliente, pedido" />}
        </Field>

        <Field id="pedido" label="Pedido">
          {(control) => <Input {...control} name="pedido" defaultValue={pedido} placeholder="Pedido" />}
        </Field>

        <Field id="orden" label="Orden de trabajo">
          {(control) => <Input {...control} name="orden" defaultValue={orden} placeholder="Orden de trabajo" />}
        </Field>

        <Field id="producto" label="Producto">
          {(control) => <Input {...control} name="producto" defaultValue={producto} placeholder="Producto" />}
        </Field>

        <DateRangeFields
          id="fecha"
          defaultFrom={parseStringParam(params, "from")}
          defaultTo={parseStringParam(params, "to")}
        />

        <Field id="estado" label="Estado">
          {(control) => (
            <NativeSelect {...control} name="estado" defaultValue={estado}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="rentable">Rentable</option>
              <option value="margen_bajo">Margen bajo</option>
            </NativeSelect>
          )}
        </Field>
      </FilterBar>

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
                    {formatDate(costing.fecha_costeo, { format: "dd/mm/yyyy" })}
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
    </div>
  );
}
