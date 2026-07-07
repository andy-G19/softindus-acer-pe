import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
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
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type PageProps = {
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

function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(2)}%`;
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
      ],
    });
  }

  if (dateRange) {
    filters.push({ fecha_costeo: dateRange });
  }

  if (lowMargin === "true") {
    filters.push({ rentabilidad: { some: { alerta_bajo_margen: true } } });
  }

  if (negativeProfit === "true") {
    filters.push({ rentabilidad: { some: { utilidad_estimada: { lt: 0 } } } });
  }

  const where: Prisma.costeoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const costings = await prisma.costeo.findMany({
    where,
    orderBy: {
      fecha_costeo: "desc",
    },
    take: 100,
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

  return (
    <main className="space-y-6">
      <PageHeader
        title="Costos y rentabilidad"
        description="Analiza costeos, márgenes aplicados, utilidad estimada y alertas de baja rentabilidad."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Reportes", href: navigationHrefs.reports },
          { label: "Rentabilidad" },
        ])}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={buildReportExportHref("profitability", exportParams)}>
                Exportar Excel
              </Link>
            </Button>
            <Button asChild>
              <Link href={buildReportExportHref("profitability", exportParams, "pdf")}>
                Exportar PDF
              </Link>
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="q">Buscar</Label>
              <Input id="q" name="q" defaultValue={q} placeholder="Costeo, pedido, cliente, producto" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from">Desde</Label>
              <Input id="from" name="from" type="date" defaultValue={from} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Hasta</Label>
              <Input id="to" name="to" type="date" defaultValue={to} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lowMargin">Margen</Label>
              <NativeSelect id="lowMargin" name="lowMargin" defaultValue={lowMargin}>
                <option value="">Todos los margenes</option>
                <option value="true">Solo margen bajo</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="negativeProfit">Utilidad</Label>
              <NativeSelect id="negativeProfit" name="negativeProfit" defaultValue={negativeProfit}>
                <option value="">Toda utilidad</option>
                <option value="true">Solo utilidad negativa</option>
              </NativeSelect>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit">Filtrar</Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/reports/profitability">Limpiar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Costeos" value={costings.length.toString()} description="Registros listados." tone="info" />
        <KpiCard title="Costo total" value={formatMoney(totals.cost)} description="Costo acumulado." tone="info" />
        <KpiCard title="Ingreso" value={formatMoney(totals.income)} description="Ingreso estimado." tone="info" />
        <KpiCard title="Utilidad" value={formatMoney(totals.profit)} description="Utilidad estimada." tone={totals.profit >= 0 ? "success" : "warning"} />
        <KpiCard title="Margen promedio" value={formatPercent(marginAverage)} description={`Alertas: ${totals.lowMargin}`} tone={totals.lowMargin > 0 ? "warning" : "success"} />
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
                        {formatMoney(profitability?.ingreso_estimado)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatMoney(profitability?.utilidad_estimada)}
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
    </main>
  );
}

