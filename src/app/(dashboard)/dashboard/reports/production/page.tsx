import {
  Activity,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
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
import { formatDate } from "@/lib/formatters";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { toNumber } from "@/lib/numbers";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";
import { exceedsReportExportRange, isReportDateRangeInverted } from "@/lib/reports/report-filters";
import {
  getProductionReportData,
  getProductionReportFilterOptions,
} from "@/modules/reports/production/queries";
import { ExportRangeNotice } from "@/modules/reports/export-range-notice";
import { InvertedRangeNotice } from "@/modules/reports/inverted-range-notice";

const ACTIVE_WORK_ORDER_STATES = ["pendiente", "en_proceso", "pausada"];

const WORK_ORDER_STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_proceso", label: "En proceso" },
  { value: "pausada", label: "Pausada" },
  { value: "finalizada", label: "Finalizada" },
  { value: "anulada", label: "Anulada" },
];

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function formatQuantity(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(2)}%`;
}

function getStatusLabel(status: string) {
  return (
    WORK_ORDER_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function getAverageProgress(
  progress: {
    porcentaje_avance: unknown;
  }[],
) {
  if (progress.length === 0) {
    return 0;
  }

  const total = progress.reduce((sum, item) => {
    return sum + toNumber(item.porcentaje_avance);
  }, 0);

  return total / progress.length;
}

type ReportFilterValues = Record<
  "dateFrom" | "dateTo" | "productId" | "status" | "orderId",
  string
>;
type ReportFilterOptions = Awaited<ReturnType<typeof getProductionReportFilterOptions>>;

// Filtros del reporte. Los pinta tambien la pantalla con el rango de fechas
// invertido, que no consulta los datos (entrega 10.2).
function ReportFilters({
  filters,
  products,
}: ReportFilterOptions & { filters: ReportFilterValues }) {
  const { dateFrom, dateTo, productId, status, orderId } = filters;

  return (
    <FilterBar
      action="/dashboard/reports/production"
      label="Filtros del reporte"
      clearHref="/dashboard/reports/production"
      submitLabel="Aplicar filtros"
    >
      <DateRangeFields
        id="fecha"
        fromName="dateFrom"
        toName="dateTo"
        fromLabel="Fecha desde"
        toLabel="Fecha hasta"
        defaultFrom={dateFrom}
        defaultTo={dateTo}
      />

      <Field id="productId" label="Producto">
        {(control) => (
          <NativeSelect {...control} name="productId" defaultValue={productId}>
            <option value="">Todos los productos</option>
            {products.map((item) => (
              <option key={item.id_producto} value={item.id_producto}>
                {item.nombre_producto}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="status" label="Estado">
        {(control) => (
          <NativeSelect {...control} name="status" defaultValue={status}>
            <option value="">Todos los estados</option>
            {WORK_ORDER_STATUS_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <Field id="orderId" label="Código de orden">
        {(control) => (
          <Input
            {...control}
            name="orderId"
            type="text"
            defaultValue={orderId}
            placeholder="Ej: OTR00000001"
          />
        )}
      </Field>
    </FilterBar>
  );
}

export default async function ProductionReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER]);

  const params = searchParams ? await searchParams : {};

  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const productId = getSearchParam(params, "productId");
  const status = getSearchParam(params, "status");
  const orderId = getSearchParam(params, "orderId").trim();

  const filters = { dateFrom, dateTo, productId, status, orderId };
  const pageHeader = {
    title: "Reporte de producción",
    description: "Consulta órdenes de trabajo por rango de fechas, producto, estado y código de orden. Este reporte permite evaluar cumplimiento, cantidad fabricada, avance y retrasos.",
    breadcrumbs: dashboardBreadcrumbs([
      { label: "Reportes", href: navigationHrefs.reports },
      { label: "Producción" },
    ]),
  };

  // Con el rango invertido no se consultan los datos ni se ofrece exportar
  // (entrega 10.2): solo las opciones de los filtros y el aviso.
  if (isReportDateRangeInverted(dateFrom, dateTo)) {
    const options = await getProductionReportFilterOptions();

    return (
      <div className="space-y-6">
        <PageHeader {...pageHeader} />
        <ReportFilters filters={filters} {...options} />
        <InvertedRangeNotice />
      </div>
    );
  }

  const csvExportHref = buildReportExportHref("production", {
   dateFrom,
   dateTo,
   productId,
   status,
   orderId,
  });

  const pdfExportHref = buildReportExportHref(
  "production",
  {
    dateFrom,
    dateTo,
    productId,
    status,
    orderId,
  },
  "pdf",
);

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const { products, workOrders } = await getProductionReportData({
    dateFrom,
    dateTo,
    productId,
    status,
    orderCode: orderId.toUpperCase(),
  });

  const totalOrders = workOrders.length;

  const activeOrders = workOrders.filter((order) => {
    return ACTIVE_WORK_ORDER_STATES.includes(order.estado);
  }).length;

  const finishedOrders = workOrders.filter((order) => {
    return order.estado === "finalizada";
  }).length;

  const delayedOrders = workOrders.filter((order) => {
    return (
      ACTIVE_WORK_ORDER_STATES.includes(order.estado) &&
      order.fecha_entrega_estimada !== null &&
      order.fecha_entrega_estimada < startOfToday
    );
  }).length;

  const totalQuantity = workOrders.reduce((sum, order) => {
    return sum + toNumber(order.cantidad);
  }, 0);

  const averageProgress =
    workOrders.length === 0
      ? 0
      : workOrders.reduce((sum, order) => {
          return sum + getAverageProgress(order.avance_orden);
        }, 0) / workOrders.length;

  const exportRangeExceeded = exceedsReportExportRange(dateFrom, dateTo);

  return (
    <div className="space-y-6">
      <PageHeader
        {...pageHeader}
        actions={
          exportRangeExceeded ? (
            <ExportRangeNotice />
          ) : (
            <>
              <Button asChild>
                <a href={csvExportHref}>Exportar Excel</a>
              </Button>

              <Button variant="destructive" asChild>
                <a href={pdfExportHref}>Exportar PDF</a>
              </Button>
            </>
          )
        }
      />

      <ReportFilters filters={filters} products={products} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard title="Órdenes encontradas" value={totalOrders.toString()} description="Cantidad de Órdenes según los filtros aplicados." tone="info" icon={ClipboardList} />
        <KpiCard title="Órdenes activas" value={activeOrders.toString()} description="Pendientes, en proceso o pausadas." tone="info" icon={Activity} />
        <KpiCard title="Órdenes finalizadas" value={finishedOrders.toString()} description="Órdenes marcadas como finalizadas." tone="success" icon={CheckCircle2} />
        <KpiCard title="Órdenes retrasadas" value={delayedOrders.toString()} description="Órdenes activas con fecha estimada vencida." tone={delayedOrders > 0 ? "warning" : "info"} icon={AlertTriangle} />
        <KpiCard title="Cantidad total" value={formatQuantity(totalQuantity)} description="Suma de cantidades planificadas a fabricar." tone="info" icon={Calculator} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado del reporte
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {workOrders.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron Órdenes de trabajo con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Orden</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Entrega estimada</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Avance</TableHead>
                  <TableHead>Ruta</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {workOrders.map((order) => {
                  const averageOrderProgress = getAverageProgress(
                    order.avance_orden,
                  );

                  const isDelayed =
                    ACTIVE_WORK_ORDER_STATES.includes(order.estado) &&
                    order.fecha_entrega_estimada !== null &&
                    order.fecha_entrega_estimada < startOfToday;

                  return (
                    <TableRow key={order.id_orden_trabajo}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/production/work-orders/${order.id_orden_trabajo}`}
                          className="hover:underline"
                        >
                          {order.id_orden_trabajo}
                        </Link>
                      </TableCell>

                      <TableCell>{order.producto.nombre_producto}</TableCell>

                      <TableCell>
                        {order.cliente?.nombre_razon_social ?? "-"}
                      </TableCell>

                      <TableCell>{order.tipo_produccion}</TableCell>

                      <TableCell>{formatQuantity(order.cantidad)}</TableCell>

                      <TableCell>{formatDate(order.fecha_inicio, { format: "dd/mm/yyyy" })}</TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <p>{formatDate(order.fecha_entrega_estimada, { format: "dd/mm/yyyy" })}</p>
                          {isDelayed ? (
                            <p className="text-xs font-medium text-destructive">
                              Retrasada
                            </p>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>{getStatusLabel(order.estado)}</TableCell>

                      <TableCell>
                        {formatPercent(averageOrderProgress)}
                      </TableCell>

                      <TableCell>
                        {order.ruta_fabricacion?.nombre_ruta ?? "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <p className="mt-3 px-6 text-xs text-muted-foreground">
            Se muestran como máximo 100 Órdenes para mantener una consulta
            rápida. En la siguiente subfase agregaremos exportación para generar
            archivos completos.
          </p>
        </CardContent>
      </Card>

      <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Promedio general de avance del reporte:{" "}
          <span className="font-medium text-foreground">
            {formatPercent(averageProgress)}
          </span>
          . Este valor se calcula usando los avances registrados por etapa en
          cada orden de trabajo.
        </p>
      </section>
    </div>
  );
}

