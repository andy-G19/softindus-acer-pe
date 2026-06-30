import Link from "next/link";
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

function parseDateInput(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function parseDateInputAsNextDay(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day + 1);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatQuantity(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatPercent(value: unknown) {
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
  }).format(value);
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

type SummaryCardProps = {
  title: string;
  value: string | number;
  description: string;
};

function SummaryCard({ title, value, description }: SummaryCardProps) {
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

export default async function ProductionReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = searchParams ? await searchParams : {};

  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const productId = getSearchParam(params, "productId");
  const status = getSearchParam(params, "status");
  const orderId = getSearchParam(params, "orderId").trim();

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

  const fromDate = parseDateInput(dateFrom);
  const toDate = parseDateInputAsNextDay(dateTo);

  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const workOrderWhere = {
    ...(fromDate || toDate
      ? {
          fecha_inicio: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lt: toDate } : {}),
          },
        }
      : {}),
    ...(productId ? { id_producto: productId } : {}),
    ...(status ? { estado: status } : {}),
    ...(orderId
      ? {
          id_orden_trabajo: {
            contains: orderId.toUpperCase(),
          },
        }
      : {}),
  };

  const [products, workOrders] = await Promise.all([
    prisma.producto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_producto: "asc",
      },
    }),

    prisma.orden_trabajo.findMany({
      where: workOrderWhere,
      orderBy: [
        {
          fecha_inicio: "desc",
        },
        {
          fecha_registro: "desc",
        },
      ],
      take: 100,
      include: {
        producto: true,
        cliente: true,
        ruta_fabricacion: true,
        avance_orden: {
          select: {
            porcentaje_avance: true,
            estado_etapa: true,
          },
        },
      },
    }),
  ]);

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

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Fase 10 · Subfase 10.3.1
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Reporte de producción
          </h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Consulta órdenes de trabajo por rango de fechas, producto, estado y
            código de orden. Este reporte permite evaluar cumplimiento,
            cantidad fabricada, avance y retrasos.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={csvExportHref}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Exportar Excel
          </a>

          <a
            href={pdfExportHref}
            className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
          >
            Exportar PDF
          </a>

          <Link
            href="/dashboard/reports"
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Volver al dashboard
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros del reporte</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-2">
              <label htmlFor="dateFrom" className="text-sm font-medium">
                Fecha desde
              </label>
              <input
                id="dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={dateFrom}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dateTo" className="text-sm font-medium">
                Fecha hasta
              </label>
              <input
                id="dateTo"
                name="dateTo"
                type="date"
                defaultValue={dateTo}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="productId" className="text-sm font-medium">
                Producto
              </label>
              <select
                id="productId"
                name="productId"
                defaultValue={productId}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los productos</option>
                {products.map((product) => (
                  <option key={product.id_producto} value={product.id_producto}>
                    {product.nombre_producto}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Estado
              </label>
              <select
                id="status"
                name="status"
                defaultValue={status}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los estados</option>
                {WORK_ORDER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="orderId" className="text-sm font-medium">
                Código de orden
              </label>
              <input
                id="orderId"
                name="orderId"
                type="text"
                defaultValue={orderId}
                placeholder="Ej: OTR00000001"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 md:col-span-2 xl:col-span-5">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Aplicar filtros
              </button>

              <Link
                href="/dashboard/reports/production"
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Limpiar filtros
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard
          title="Órdenes encontradas"
          value={totalOrders}
          description="Cantidad de órdenes según los filtros aplicados."
        />

        <SummaryCard
          title="Órdenes activas"
          value={activeOrders}
          description="Pendientes, en proceso o pausadas."
        />

        <SummaryCard
          title="Órdenes finalizadas"
          value={finishedOrders}
          description="Órdenes marcadas como finalizadas."
        />

        <SummaryCard
          title="Órdenes retrasadas"
          value={delayedOrders}
          description="Órdenes activas con fecha estimada vencida."
        />

        <SummaryCard
          title="Cantidad total"
          value={formatQuantity(totalQuantity)}
          description="Suma de cantidades planificadas a fabricar."
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado del reporte
          </CardTitle>
        </CardHeader>

        <CardContent>
          {workOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron órdenes de trabajo con los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Orden</th>
                    <th className="py-2 pr-3 font-medium">Producto</th>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Tipo</th>
                    <th className="py-2 pr-3 font-medium">Cantidad</th>
                    <th className="py-2 pr-3 font-medium">Inicio</th>
                    <th className="py-2 pr-3 font-medium">Entrega estimada</th>
                    <th className="py-2 pr-3 font-medium">Estado</th>
                    <th className="py-2 pr-3 font-medium">Avance</th>
                    <th className="py-2 pr-3 font-medium">Ruta</th>
                  </tr>
                </thead>

                <tbody>
                  {workOrders.map((order) => {
                    const averageOrderProgress = getAverageProgress(
                      order.avance_orden,
                    );

                    const isDelayed =
                      ACTIVE_WORK_ORDER_STATES.includes(order.estado) &&
                      order.fecha_entrega_estimada !== null &&
                      order.fecha_entrega_estimada < startOfToday;

                    return (
                      <tr key={order.id_orden_trabajo} className="border-b">
                        <td className="py-2 pr-3 font-medium">
                          <Link
                            href={`/dashboard/production/work-orders/${order.id_orden_trabajo}`}
                            className="hover:underline"
                          >
                            {order.id_orden_trabajo}
                          </Link>
                        </td>

                        <td className="py-2 pr-3">
                          {order.producto.nombre_producto}
                        </td>

                        <td className="py-2 pr-3">
                          {order.cliente?.nombre_razon_social ?? "-"}
                        </td>

                        <td className="py-2 pr-3">
                          {order.tipo_produccion}
                        </td>

                        <td className="py-2 pr-3">
                          {formatQuantity(order.cantidad)}
                        </td>

                        <td className="py-2 pr-3">
                          {formatDate(order.fecha_inicio)}
                        </td>

                        <td className="py-2 pr-3">
                          <div className="space-y-1">
                            <p>{formatDate(order.fecha_entrega_estimada)}</p>
                            {isDelayed ? (
                              <p className="text-xs font-medium text-red-600">
                                Retrasada
                              </p>
                            ) : null}
                          </div>
                        </td>

                        <td className="py-2 pr-3">
                          {getStatusLabel(order.estado)}
                        </td>

                        <td className="py-2 pr-3">
                          {formatPercent(averageOrderProgress)}
                        </td>

                        <td className="py-2 pr-3">
                          {order.ruta_fabricacion?.nombre_ruta ?? "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Se muestran como máximo 100 órdenes para mantener una consulta
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
