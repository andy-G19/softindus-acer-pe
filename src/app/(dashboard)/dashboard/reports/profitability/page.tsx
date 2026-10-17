import { CircleDollarSign, ClipboardList, TrendingUp } from "lucide-react";
import { DateRangeFields } from "@/components/forms/date-range-fields";
import { Field } from "@/components/forms/field";
import { FilterBar } from "@/components/forms/filter-bar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { formatMoney } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";
import { exceedsReportExportRange, isReportDateRangeInverted } from "@/lib/reports/report-filters";
import { getProfitabilityReportData } from "@/modules/reports/profitability/queries";
import { ExportRangeNotice } from "@/modules/reports/export-range-notice";
import { InvertedRangeNotice } from "@/modules/reports/inverted-range-notice";
import {
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type PageProps = {
  searchParams?: Promise<SearchParamsRecord>;
};

function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(2)}%`;
}

type ReportFilterValues = Record<"q" | "from" | "to" | "lowMargin" | "negativeProfit", string>;

// Filtros del reporte. Los pinta tambien la pantalla con el rango de fechas
// invertido, que no consulta los datos (entrega 10.2).
function ReportFilters({ filters }: { filters: ReportFilterValues }) {
  const { q, from, to, lowMargin, negativeProfit } = filters;

  return (
    <FilterBar
      action="/dashboard/reports/profitability"
      label="Filtros de costos y rentabilidad"
      clearHref="/dashboard/reports/profitability"
      clearLabel="Limpiar"
    >
      <Field id="q" label="Buscar">
        {(control) => (
          <Input {...control} name="q" defaultValue={q} placeholder="Costeo, pedido, cliente, producto" />
        )}
      </Field>
      <DateRangeFields id="fecha" defaultFrom={from} defaultTo={to} />
      <Field id="lowMargin" label="Margen">
        {(control) => (
          <NativeSelect {...control} name="lowMargin" defaultValue={lowMargin}>
            <option value="">Todos los margenes</option>
            <option value="true">Solo margen bajo</option>
          </NativeSelect>
        )}
      </Field>
      <Field id="negativeProfit" label="Utilidad">
        {(control) => (
          <NativeSelect {...control} name="negativeProfit" defaultValue={negativeProfit}>
            <option value="">Toda utilidad</option>
            <option value="true">Solo utilidad negativa</option>
          </NativeSelect>
        )}
      </Field>
    </FilterBar>
  );
}

export default async function ProfitabilityReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const from = parseStringParam(params, "from");
  const to = parseStringParam(params, "to");
  const lowMargin = parseStringParam(params, "lowMargin");
  const negativeProfit = parseStringParam(params, "negativeProfit");
  const filters = { q, from, to, lowMargin, negativeProfit };
  const pageHeader = {
    title: "Costos y rentabilidad",
    description: "Analiza costeos, márgenes aplicados, utilidad estimada y alertas de baja rentabilidad.",
    breadcrumbs: dashboardBreadcrumbs([
      { label: "Reportes", href: navigationHrefs.reports },
      { label: "Rentabilidad" },
    ]),
  };

  // Con el rango invertido no se consultan los datos ni se ofrece exportar
  // (entrega 10.2): solo las opciones de los filtros y el aviso.
  if (isReportDateRangeInverted(from, to)) {
    return (
      <div className="space-y-6">
        <PageHeader {...pageHeader} />
        <ReportFilters filters={filters} />
        <InvertedRangeNotice />
      </div>
    );
  }

  const costings = await getProfitabilityReportData({
    q,
    lowMargin,
    negativeProfit,
    from,
    to,
  });

  const totals = costings.reduce(
    (acc, costing) => {
      const profitability = costing.rentabilidad[0];

      acc.cost += toNumber(costing.costo_total);
      acc.income += toNumber(profitability?.ingreso_estimado);
      acc.profit += toNumber(profitability?.utilidad_estimada);

      if (profitability?.alerta_bajo_margen) {
        acc.lowMargin += 1;
      }

      return acc;
    },
    { cost: 0, income: 0, profit: 0, lowMargin: 0 },
  );

  const marginAverage =
    totals.income > 0 ? (totals.profit / totals.income) * 100 : 0;

  const exportParams = {
    q,
    from,
    to,
    lowMargin,
    negativeProfit,
  };

  const exportRangeExceeded = exceedsReportExportRange(from, to);

  return (
    <div className="space-y-6">
      <PageHeader
        {...pageHeader}
        actions={
          exportRangeExceeded ? (
            <ExportRangeNotice />
          ) : (
            <>
              <Button variant="outline" asChild>
                <a href={buildReportExportHref("profitability", exportParams)}>
                  Exportar Excel
                </a>
              </Button>
              <Button asChild>
                <a href={buildReportExportHref("profitability", exportParams, "pdf")}>
                  Exportar PDF
                </a>
              </Button>
            </>
          )
        }
      />

      <ReportFilters filters={filters} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Costeos" value={costings.length.toString()} description="Registros listados." tone="info" icon={ClipboardList} />
        <KpiCard title="Costo total" value={formatMoney(totals.cost)} description="Costo acumulado." tone="info" icon={CircleDollarSign} />
        <KpiCard title="Ingreso" value={formatMoney(totals.income)} description="Ingreso estimado." tone="info" icon={TrendingUp} />
        <KpiCard title="Utilidad" value={formatMoney(totals.profit)} description="Utilidad estimada." tone={totals.profit >= 0 ? "success" : "warning"} icon={TrendingUp} />
        <KpiCard title="Margen promedio" value={formatPercent(marginAverage)} description={`Alertas: ${totals.lowMargin}`} tone={totals.lowMargin > 0 ? "warning" : "success"} icon={TrendingUp} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultados</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {costings.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron costeos con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Costeo</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Cliente / Producto</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="text-right">Ingreso</TableHead>
                  <TableHead className="text-right">Utilidad</TableHead>
                  <TableHead className="text-right">Margen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costings.map((costing) => {
                  const profitability = costing.rentabilidad[0];
                  const client =
                    costing.pedido?.cliente.nombre_razon_social ??
                    costing.orden_trabajo?.cliente?.nombre_razon_social ??
                    "-";

                  return (
                    <TableRow key={costing.id_costeo}>
                      <TableCell className="font-mono text-xs">
                        {costing.id_costeo}
                      </TableCell>
                      <TableCell>
                        {costing.id_pedido ?? costing.id_orden_trabajo ?? "-"}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{client}</p>
                        <p className="text-xs text-muted-foreground">
                          {costing.orden_trabajo?.producto.nombre_producto ?? "-"}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(costing.costo_total)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(profitability?.ingreso_estimado ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(profitability?.utilidad_estimada ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {profitability ? formatPercent(profitability.margen_real) : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

