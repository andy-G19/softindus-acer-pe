import {
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Landmark,
  Receipt,
} from "lucide-react";
import Link from "next/link";
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

const ORDER_STATUS_OPTIONS = [
  { value: "registrado", label: "Registrado" },
  { value: "aprobado", label: "Aprobado" },
  { value: "en_produccion", label: "En producción" },
  { value: "entregado", label: "Entregado" },
  { value: "cancelado", label: "Cancelado" },
];

const COLLECTION_STATUS_OPTIONS = [
  { value: "sin_proforma", label: "Sin proforma" },
  { value: "sin_pago", label: "Sin pago" },
  { value: "con_saldo", label: "Con saldo pendiente" },
  { value: "pagado", label: "Pagado" },
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

function getOrderStatusLabel(status: string) {
  return (
    ORDER_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function getCollectionStatusLabel(status: string) {
  return (
    COLLECTION_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function getPaymentTotalByType(
  payments: {
    tipo_pago: string;
    monto_pagado: unknown;
  }[],
  type: string,
) {
  return payments.reduce((sum, payment) => {
    if (payment.tipo_pago !== type) {
      return sum;
    }

    return sum + toNumber(payment.monto_pagado);
  }, 0);
}

function getCollectionStatus(data: {
  hasQuote: boolean;
  totalPaid: number;
  pendingBalance: number;
}) {
  if (!data.hasQuote) {
    return "sin_proforma";
  }

  if (data.totalPaid <= 0 && data.pendingBalance > 0) {
    return "sin_pago";
  }

  if (data.pendingBalance > 0) {
    return "con_saldo";
  }

  return "pagado";
}

export default async function SalesCollectionsReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN, APP_ROLES.SELLER]);

  const params = searchParams ? await searchParams : {};

  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const clientId = getSearchParam(params, "clientId");
  const orderStatus = getSearchParam(params, "orderStatus");
  const collectionStatus = getSearchParam(params, "collectionStatus");
  const searchCode = getSearchParam(params, "searchCode").trim();

  const csvExportHref = buildReportExportHref("sales-collections", {
    dateFrom,
    dateTo,
    clientId,
    orderStatus,
    collectionStatus,
    searchCode,
  });

  const pdfExportHref = buildReportExportHref(
  "sales-collections",
  {
    dateFrom,
    dateTo,
    clientId,
    orderStatus,
    collectionStatus,
    searchCode,
  },
  "pdf",
  );


  const fromDate = parseDateInput(dateFrom);
  const toDate = parseDateInputAsNextDay(dateTo);
  const normalizedCode = searchCode.toUpperCase();

  const orderWhere = {
    ...(fromDate || toDate
      ? {
          fecha_pedido: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lt: toDate } : {}),
          },
        }
      : {}),
    ...(clientId ? { id_cliente: clientId } : {}),
    ...(orderStatus ? { estado: orderStatus } : {}),
    ...(normalizedCode
      ? {
          OR: [
            {
              id_pedido: {
                contains: normalizedCode,
              },
            },
            {
              proforma: {
                some: {
                  OR: [
                    {
                      id_proforma: {
                        contains: normalizedCode,
                      },
                    },
                    {
                      numero_proforma: {
                        contains: normalizedCode,
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  const [clients, orders] = await Promise.all([
    prisma.cliente.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_razon_social: "asc",
      },
    }),

    prisma.pedido.findMany({
      where: orderWhere,
      orderBy: {
        fecha_pedido: "desc",
      },
      take: 100,
      include: {
        cliente: true,
        proforma: {
          orderBy: {
            fecha_emision: "desc",
          },
          include: {
            pago_cliente: {
              orderBy: {
                fecha_pago: "asc",
              },
            },
            comprobante_venta: true,
          },
        },
        detalle_pedido: {
          include: {
            producto: true,
          },
        },
      },
    }),
  ]);

  const reportRows = orders
    .map((order) => {
      const quote = order.proforma[0] ?? null;
      const payments = quote?.pago_cliente ?? [];

      const quotedAmount = toNumber(quote?.monto_total);
      const initialAdvance = toNumber(quote?.adelanto_inicial);
      const advancePayments = getPaymentTotalByType(payments, "adelanto");
      const amortizationPayments = getPaymentTotalByType(
        payments,
        "amortizacion",
      );
      const cancellationPayments = getPaymentTotalByType(
        payments,
        "cancelacion",
      );

      const totalPaid =
        initialAdvance +
        advancePayments +
        amortizationPayments +
        cancellationPayments;

      const pendingBalance = quote ? toNumber(quote.saldo) : 0;

      const currentCollectionStatus = getCollectionStatus({
        hasQuote: Boolean(quote),
        totalPaid,
        pendingBalance,
      });

      return {
        order,
        quote,
        payments,
        quotedAmount,
        initialAdvance,
        advancePayments,
        amortizationPayments,
        cancellationPayments,
        totalPaid,
        pendingBalance,
        collectionStatus: currentCollectionStatus,
      };
    })
    .filter((row) => {
      if (!collectionStatus) {
        return true;
      }

      return row.collectionStatus === collectionStatus;
    });

  const totalOrders = reportRows.length;

  const estimatedAmount = reportRows.reduce((sum, row) => {
    return sum + toNumber(row.order.monto_estimado);
  }, 0);

  const totalQuoted = reportRows.reduce((sum, row) => {
    return sum + row.quotedAmount;
  }, 0);

  const totalInitialAdvances = reportRows.reduce((sum, row) => {
    return sum + row.initialAdvance;
  }, 0);

  const totalAdvancePayments = reportRows.reduce((sum, row) => {
    return sum + row.advancePayments;
  }, 0);

  const totalAmortizations = reportRows.reduce((sum, row) => {
    return sum + row.amortizationPayments;
  }, 0);

  const totalCancellations = reportRows.reduce((sum, row) => {
    return sum + row.cancellationPayments;
  }, 0);

  const totalPaid = reportRows.reduce((sum, row) => {
    return sum + row.totalPaid;
  }, 0);

  const totalPendingBalance = reportRows.reduce((sum, row) => {
    return sum + row.pendingBalance;
  }, 0);

  const paidOrders = reportRows.filter((row) => {
    return row.collectionStatus === "pagado";
  }).length;

  const pendingBalanceOrders = reportRows.filter((row) => {
    return row.collectionStatus === "con_saldo";
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reporte de ventas y cobranzas"
        description="Consulta pedidos, proformas, adelantos, amortizaciones, cancelaciones, saldos pendientes y estados de cobranza."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Reportes", href: navigationHrefs.reports },
          { label: "Ventas y cobranzas" },
        ])}
        actions={
          <>
            <Button asChild>
              <a href={csvExportHref}>Exportar Excel</a>
            </Button>

            <Button variant="destructive" asChild>
              <a href={pdfExportHref}>Exportar PDF</a>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros del reporte</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Fecha desde</Label>
              <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Fecha hasta</Label>
              <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientId">Cliente</Label>
              <NativeSelect id="clientId" name="clientId" defaultValue={clientId}>
                <option value="">Todos los clientes</option>
                {clients.map((client) => (
                  <option key={client.id_cliente} value={client.id_cliente}>
                    {client.nombre_razon_social}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orderStatus">Estado del pedido</Label>
              <NativeSelect id="orderStatus" name="orderStatus" defaultValue={orderStatus}>
                <option value="">Todos los estados</option>
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collectionStatus">Estado de cobranza</Label>
              <NativeSelect id="collectionStatus" name="collectionStatus" defaultValue={collectionStatus}>
                <option value="">Todos los estados</option>
                {COLLECTION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="searchCode">Pedido o proforma</Label>
              <Input
                id="searchCode"
                name="searchCode"
                type="text"
                defaultValue={searchCode}
                placeholder="Ej: PED00000001 o PF-00000001"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
              <Button type="submit">Aplicar filtros</Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/reports/sales-collections">
                  Limpiar filtros
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Pedidos encontrados" value={totalOrders.toString()} description="Pedidos según los filtros aplicados." tone="info" icon={ClipboardList} />
        <KpiCard title="Monto estimado" value={formatMoney(estimatedAmount)} description="Suma del monto estimado de pedidos." tone="info" icon={CircleDollarSign} />
        <KpiCard title="Monto proformado" value={formatMoney(totalQuoted)} description="Suma de proformas emitidas." tone="info" icon={CircleDollarSign} />
        <KpiCard title="Total cobrado" value={formatMoney(totalPaid)} description="Adelantos iniciales, adelantos, amortizaciones y cancelaciones." tone="success" icon={CircleDollarSign} />
        <KpiCard title="Saldo pendiente" value={formatMoney(totalPendingBalance)} description={`Pedidos con saldo: ${pendingBalanceOrders}.`} tone={totalPendingBalance > 0 ? "warning" : "info"} icon={Landmark} />
        <KpiCard title="Pedidos pagados" value={paidOrders.toString()} description="Pedidos con proforma sin saldo pendiente." tone="success" icon={CheckCircle2} />
        <KpiCard title="Adelantos" value={formatMoney(totalInitialAdvances + totalAdvancePayments)} description="Adelantos iniciales y pagos tipo adelanto." tone="info" icon={Receipt} />
        <KpiCard title="Amortizaciones" value={formatMoney(totalAmortizations)} description={`Cancelaciones: ${formatMoney(totalCancellations)}.`} tone="info" icon={Receipt} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado del reporte
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {reportRows.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron ventas o cobranzas con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Estado pedido</TableHead>
                  <TableHead>Monto estimado</TableHead>
                  <TableHead>Proforma</TableHead>
                  <TableHead>Monto proformado</TableHead>
                  <TableHead>Adelantos</TableHead>
                  <TableHead>Amortizaciones</TableHead>
                  <TableHead>Cancelaciones</TableHead>
                  <TableHead>Cobrado</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Cobranza</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {reportRows.map((row) => (
                  <TableRow key={row.order.id_pedido}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/commercial/orders/${row.order.id_pedido}`}
                        className="hover:underline"
                      >
                        {row.order.id_pedido}
                      </Link>
                    </TableCell>

                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {row.order.cliente.nombre_razon_social}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.order.cliente.tipo_cliente}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>{formatDate(row.order.fecha_pedido)}</TableCell>

                    <TableCell>{getOrderStatusLabel(row.order.estado)}</TableCell>

                    <TableCell>{formatMoney(row.order.monto_estimado)}</TableCell>

                    <TableCell>
                      {row.quote ? (
                        <Link
                          href={`/dashboard/commercial/quotes/${row.quote.id_proforma}`}
                          className="hover:underline"
                        >
                          <span className="font-medium">
                            {row.quote.numero_proforma}
                          </span>
                          <br />
                          <span className="text-xs text-muted-foreground">
                            {row.quote.estado}
                          </span>
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    <TableCell>{formatMoney(row.quotedAmount)}</TableCell>

                    <TableCell>
                      {formatMoney(row.initialAdvance + row.advancePayments)}
                    </TableCell>

                    <TableCell>
                      {formatMoney(row.amortizationPayments)}
                    </TableCell>

                    <TableCell>
                      {formatMoney(row.cancellationPayments)}
                    </TableCell>

                    <TableCell>{formatMoney(row.totalPaid)}</TableCell>

                    <TableCell>{formatMoney(row.pendingBalance)}</TableCell>

                    <TableCell>
                      {getCollectionStatusLabel(row.collectionStatus)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <p className="mt-3 px-6 text-xs text-muted-foreground">
            Se muestran como máximo 100 pedidos para mantener una consulta
            rápida. En la subfase de exportación se generarán archivos completos
            según los filtros aplicados.
          </p>
        </CardContent>
      </Card>

      <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Este reporte consolida la trazabilidad comercial: pedido, cliente,
          proforma, pagos realizados, saldo pendiente y estado de cobranza. Su
          precisión depende del registro correcto de proformas, adelantos,
          amortizaciones y cancelaciones.
        </p>
      </section>
    </div>
  );
}

