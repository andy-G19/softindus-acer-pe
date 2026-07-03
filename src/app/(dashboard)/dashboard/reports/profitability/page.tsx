import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
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

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string | number;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Reportes</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Costos y rentabilidad
          </h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Analiza costeos, margenes aplicados, utilidad estimada y alertas de
            baja rentabilidad.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/reports" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            Volver
          </Link>
          <Link href={buildReportExportHref("profitability", exportParams)} className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
            Exportar Excel
          </Link>
          <Link href={buildReportExportHref("profitability", exportParams, "pdf")} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
            Exportar PDF
          </Link>
        </div>
      </section>

      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <input name="q" defaultValue={q} placeholder="Costeo, pedido, cliente, producto" className="rounded-md border px-3 py-2 text-sm" />
            <input name="from" type="date" defaultValue={from} className="rounded-md border px-3 py-2 text-sm" />
            <input name="to" type="date" defaultValue={to} className="rounded-md border px-3 py-2 text-sm" />
            <select name="lowMargin" defaultValue={lowMargin} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Todos los margenes</option>
              <option value="true">Solo margen bajo</option>
            </select>
            <select name="negativeProfit" defaultValue={negativeProfit} className="rounded-md border px-3 py-2 text-sm">
              <option value="">Toda utilidad</option>
              <option value="true">Solo utilidad negativa</option>
            </select>
            <div className="flex gap-2">
              <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Filtrar
              </button>
              <Link href="/dashboard/reports/profitability" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
                Limpiar
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard title="Costeos" value={costings.length} description="Registros listados." />
        <SummaryCard title="Costo total" value={formatMoney(totals.cost)} description="Costo acumulado." />
        <SummaryCard title="Ingreso" value={formatMoney(totals.income)} description="Ingreso estimado." />
        <SummaryCard title="Utilidad" value={formatMoney(totals.profit)} description="Utilidad estimada." />
        <SummaryCard title="Margen promedio" value={formatPercent(marginAverage)} description={`Alertas: ${totals.lowMargin}`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultados</CardTitle>
        </CardHeader>
        <CardContent>
          {costings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron costeos con los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Costeo</th>
                    <th className="py-2 pr-3">Origen</th>
                    <th className="py-2 pr-3">Cliente / Producto</th>
                    <th className="py-2 pr-3 text-right">Costo</th>
                    <th className="py-2 pr-3 text-right">Ingreso</th>
                    <th className="py-2 pr-3 text-right">Utilidad</th>
                    <th className="py-2 text-right">Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {costings.map((costing) => {
                    const profitability = costing.rentabilidad[0];
                    const client =
                      costing.pedido?.cliente.nombre_razon_social ??
                      costing.orden_trabajo?.cliente?.nombre_razon_social ??
                      "-";

                    return (
                      <tr key={costing.id_costeo} className="border-b">
                        <td className="py-2 pr-3 font-mono text-xs">{costing.id_costeo}</td>
                        <td className="py-2 pr-3">{costing.id_pedido ?? costing.id_orden_trabajo ?? "-"}</td>
                        <td className="py-2 pr-3">
                          <p className="font-medium">{client}</p>
                          <p className="text-xs text-muted-foreground">{costing.orden_trabajo?.producto.nombre_producto ?? "-"}</p>
                        </td>
                        <td className="py-2 pr-3 text-right">{formatMoney(costing.costo_total)}</td>
                        <td className="py-2 pr-3 text-right">{formatMoney(profitability?.ingreso_estimado)}</td>
                        <td className="py-2 pr-3 text-right">{formatMoney(profitability?.utilidad_estimada)}</td>
                        <td className="py-2 text-right">
                          {profitability ? formatPercent(profitability.margen_real) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
