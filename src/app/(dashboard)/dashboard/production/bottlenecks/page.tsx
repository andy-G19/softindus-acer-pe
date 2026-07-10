import Link from "next/link";
import { requireRole } from "@/lib/authz";
import { SearchableSelectFilter } from "@/components/forms/searchable-select-filter";
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
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  createReturnToHref,
  dashboardBreadcrumbs,
  navigationHrefs,
  withReturnTo,
} from "@/lib/navigation";

type AlertStatus = "normal" | "en riesgo" | "atrasada";

type StageSummary = {
  id: string;
  name: string;
  orderCount: number;
  delayedCount: number;
  riskCount: number;
  maxElapsedHours: number;
  estimatedHours: number | null;
};

type ProductionBottlenecksPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const numericValue = Number(value.toString());

  return Number.isFinite(numericValue) ? numericValue : null;
}

function getElapsedHours(startDate: Date | null | undefined, now: Date) {
  if (!startDate) {
    return 0;
  }

  const elapsedMilliseconds = now.getTime() - startDate.getTime();

  return Math.max(elapsedMilliseconds / 1000 / 60 / 60, 0);
}

function getAlertStatus(
  estimatedHours: number | null,
  elapsedHours: number,
): AlertStatus {
  if (!estimatedHours || estimatedHours <= 0) {
    return "normal";
  }

  if (elapsedHours > estimatedHours) {
    return "atrasada";
  }

  if (elapsedHours >= estimatedHours * 0.8) {
    return "en riesgo";
  }

  return "normal";
}

function getAlertBadgeVariant(status: AlertStatus) {
  if (status === "atrasada") {
    return "destructive" as const;
  }

  if (status === "en riesgo") {
    return "warning" as const;
  }

  return "success" as const;
}

function formatHours(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${value.toFixed(2)} h`;
}

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function parseDate(value: string, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function ProductionBottlenecksPage({
  searchParams,
}: ProductionBottlenecksPageProps) {
  await requireRole(["ADMIN", "WORKSHOP_MASTER"]);

  const params = (await searchParams) ?? {};
  const product = getSearchParam(params, "product");
  const route = getSearchParam(params, "route");
  const stage = getSearchParam(params, "stage");
  const orderStatus = getSearchParam(params, "orderStatus");
  const from = getSearchParam(params, "from");
  const to = getSearchParam(params, "to");
  const returnTo = createReturnToHref(navigationHrefs.bottlenecks, params);
  const fromDate = parseDate(from);
  const toDate = parseDate(to, true);
  const filters: Prisma.avance_ordenWhereInput[] = [
    {
      estado_etapa: "en_proceso",
    },
  ];

  if (product) {
    filters.push({
      orden_trabajo: {
        id_producto: product,
      },
    });
  }

  if (route) {
    filters.push({
      etapa_ruta: {
        id_ruta: route,
      },
    });
  }

  if (stage) {
    filters.push({
      id_etapa_ruta: stage,
    });
  }

  if (orderStatus) {
    filters.push({
      orden_trabajo: {
        estado: orderStatus,
      },
    });
  }

  if (fromDate || toDate) {
    filters.push({
      fecha_inicio_etapa: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: toDate } : {}),
      },
    });
  }

  const [activeAdvances, products, routes, stages] = await Promise.all([
    prisma.avance_orden.findMany({
      where: {
        AND: filters,
      },
      include: {
        etapa_ruta: true,
        operario: true,
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
      },
      orderBy: [
        {
          fecha_inicio_etapa: "asc",
        },
        {
          id_avance: "asc",
        },
      ],
    }),
    prisma.producto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_producto: "asc",
      },
      select: {
        id_producto: true,
        nombre_producto: true,
      },
    }),
    prisma.ruta_fabricacion.findMany({
      orderBy: {
        nombre_ruta: "asc",
      },
      select: {
        id_ruta: true,
        nombre_ruta: true,
      },
    }),
    prisma.etapa_ruta.findMany({
      orderBy: [
        {
          nombre_etapa: "asc",
        },
      ],
      select: {
        id_etapa_ruta: true,
        nombre_etapa: true,
      },
    }),
  ]);

  const now = new Date();

  const rows = activeAdvances.map((advance) => {
    const estimatedHours = toNumber(advance.etapa_ruta.tiempo_estimado_horas);
    const elapsedHours = getElapsedHours(advance.fecha_inicio_etapa, now);
    const alertStatus = getAlertStatus(estimatedHours, elapsedHours);

    return {
      id_avance: advance.id_avance,
      id_orden_trabajo: advance.id_orden_trabajo,
      productName: advance.orden_trabajo.producto.nombre_producto,
      stageId: advance.id_etapa_ruta,
      stageName: advance.etapa_ruta.nombre_etapa,
      stageOrder: advance.etapa_ruta.orden_secuencia,
      operatorName: advance.operario
        ? `${advance.operario.apellidos}, ${advance.operario.nombres}`
        : "Sin operario asignado",
      estimatedHours,
      elapsedHours,
      alertStatus,
    };
  });

  const stageSummaries = Array.from(
    rows
      .reduce((summaryMap, row) => {
        const current = summaryMap.get(row.stageId) ?? {
          id: row.stageId,
          name: row.stageName,
          orderCount: 0,
          delayedCount: 0,
          riskCount: 0,
          maxElapsedHours: 0,
          estimatedHours: row.estimatedHours,
        };

        current.orderCount += 1;
        current.maxElapsedHours = Math.max(
          current.maxElapsedHours,
          row.elapsedHours,
        );

        if (row.alertStatus === "atrasada") {
          current.delayedCount += 1;
        }

        if (row.alertStatus === "en riesgo") {
          current.riskCount += 1;
        }

        summaryMap.set(row.stageId, current);

        return summaryMap;
      }, new Map<string, StageSummary>())
      .values(),
  ).sort((a, b) => {
    if (b.orderCount !== a.orderCount) {
      return b.orderCount - a.orderCount;
    }

    if (b.delayedCount !== a.delayedCount) {
      return b.delayedCount - a.delayedCount;
    }

    return b.maxElapsedHours - a.maxElapsedHours;
  });

  const delayedRows = rows.filter((row) => row.alertStatus === "atrasada");
  const riskRows = rows.filter((row) => row.alertStatus === "en riesgo");
  const saturatedStages = stageSummaries.filter(
    (summary) => summary.orderCount > 1,
  );
  const productItems = products.map((item) => ({
    id: item.id_producto,
    label: item.nombre_producto,
    description: item.id_producto,
  }));

  return (
    <main className="space-y-6">
      <PageHeader
        title="Cuellos de botella en producción"
        description="Detecta avances en proceso cercanos a vencer, atrasados o concentrados en una misma etapa."
        backHref={navigationHrefs.production}
        backLabel="Volver a producción"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Producción", href: navigationHrefs.production },
          { label: "Cuellos de botella" },
        ])}
      />

      <form className="grid gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-4">
        <SearchableSelectFilter
          key={product}
          name="product"
          label="Producto"
          placeholder="Todos los productos"
          items={productItems}
          value={product}
          emptyMessage="No se encontraron productos."
        />

        <div className="space-y-2">
          <Label htmlFor="route">Ruta</Label>
          <NativeSelect id="route" name="route" defaultValue={route}>
            <option value="">Todas las rutas</option>
            {routes.map((item) => (
              <option key={item.id_ruta} value={item.id_ruta}>
                {item.nombre_ruta}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="stage">Etapa</Label>
          <NativeSelect id="stage" name="stage" defaultValue={stage}>
            <option value="">Todas las etapas</option>
            {stages.map((item) => (
              <option key={item.id_etapa_ruta} value={item.id_etapa_ruta}>
                {item.nombre_etapa}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="orderStatus">Estado de orden</Label>
          <NativeSelect
            id="orderStatus"
            name="orderStatus"
            defaultValue={orderStatus}
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="pausada">Pausada</option>
          </NativeSelect>
        </div>

        <div className="grid grid-cols-2 gap-2 md:col-span-2">
          <div className="space-y-2">
            <Label htmlFor="from">Desde</Label>
            <Input id="from" name="from" type="date" defaultValue={from} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="to">Hasta</Label>
            <Input id="to" name="to" type="date" defaultValue={to} />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 md:col-span-2">
          <Button type="submit">Filtrar</Button>

          <Button variant="outline" asChild>
            <Link href="/dashboard/production/bottlenecks">
              Limpiar filtros
            </Link>
          </Button>
        </div>
      </form>

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Avances en proceso" value={rows.length.toString()} description="Etapas activas monitoreadas." tone="info" />
        <KpiCard title="Atrasados" value={delayedRows.length.toString()} description="Superan el tiempo estimado." tone="warning" />
        <KpiCard title="En riesgo" value={riskRows.length.toString()} description="Cerca de vencer." tone="warning" />
        <KpiCard title="Etapas saturadas" value={saturatedStages.length.toString()} description="Más de una orden simultánea." tone="warning" />
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Etapa</TableHead>
            <TableHead>Órdenes en etapa</TableHead>
            <TableHead>Atrasadas</TableHead>
            <TableHead>En riesgo</TableHead>
            <TableHead>Tiempo estimado</TableHead>
            <TableHead>Mayor permanencia</TableHead>
            <TableHead>Saturación</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {stageSummaries.map((summary) => (
            <TableRow key={summary.id}>
              <TableCell className="font-medium">{summary.name}</TableCell>
              <TableCell>{summary.orderCount}</TableCell>
              <TableCell>{summary.delayedCount}</TableCell>
              <TableCell>{summary.riskCount}</TableCell>
              <TableCell>{formatHours(summary.estimatedHours)}</TableCell>
              <TableCell>{formatHours(summary.maxElapsedHours)}</TableCell>
              <TableCell>
                <Badge variant={summary.orderCount > 1 ? "warning" : "outline"}>
                  {summary.orderCount > 1 ? "Saturada" : "Normal"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}

          {stageSummaries.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="p-0">
                <EmptyState
                  className="border-0"
                  label="No hay avances en proceso para analizar."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código de orden</TableHead>
            <TableHead>Producto</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead>Operario</TableHead>
            <TableHead>Horas estimadas</TableHead>
            <TableHead>Horas transcurridas</TableHead>
            <TableHead>Estado de alerta</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id_avance}>
              <TableCell className="text-xs">
                <Button variant="link" className="h-auto p-0" asChild>
                  <Link
                    href={withReturnTo(
                      `${navigationHrefs.workOrders}/${row.id_orden_trabajo}/progress`,
                      returnTo,
                    )}
                  >
                    {row.id_orden_trabajo}
                  </Link>
                </Button>
              </TableCell>
              <TableCell>{row.productName}</TableCell>
              <TableCell>
                <div className="font-medium">{row.stageName}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Secuencia: {row.stageOrder}
                </p>
              </TableCell>
              <TableCell>{row.operatorName}</TableCell>
              <TableCell>{formatHours(row.estimatedHours)}</TableCell>
              <TableCell>{formatHours(row.elapsedHours)}</TableCell>
              <TableCell>
                <Badge variant={getAlertBadgeVariant(row.alertStatus)}>
                  {row.alertStatus}
                </Badge>
              </TableCell>
            </TableRow>
          ))}

          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="p-0">
                <EmptyState
                  className="border-0"
                  label="No hay avances con estado en_proceso."
                />
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </main>
  );
}
