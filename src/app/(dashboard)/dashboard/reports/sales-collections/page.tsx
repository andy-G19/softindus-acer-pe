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

export default async function SalesCollectionsReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Fase 10 · Subfase 10.3.3
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Reporte de ventas y cobranzas
          </h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Consulta pedidos, proformas, adelantos, amortizaciones,
            cancelaciones, saldos pendientes y estados de cobranza.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={csvExportHref}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Exportar CSV/Excel
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
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
              <label htmlFor="clientId" className="text-sm font-medium">
                Cliente
              </label>
              <select
                id="clientId"
                name="clientId"
                defaultValue={clientId}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los clientes</option>
                {clients.map((client) => (
                  <option key={client.id_cliente} value={client.id_cliente}>
                    {client.nombre_razon_social}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="orderStatus" className="text-sm font-medium">
                Estado del pedido
              </label>
              <select
                id="orderStatus"
                name="orderStatus"
                defaultValue={orderStatus}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los estados</option>
                {ORDER_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="collectionStatus"
                className="text-sm font-medium"
              >
                Estado de cobranza
              </label>
              <select
                id="collectionStatus"
                name="collectionStatus"
                defaultValue={collectionStatus}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los estados</option>
                {COLLECTION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="searchCode" className="text-sm font-medium">
                Pedido o proforma
              </label>
              <input
                id="searchCode"
                name="searchCode"
                type="text"
                defaultValue={searchCode}
                placeholder="Ej: PED00000001 o PF-00000001"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 md:col-span-2 xl:col-span-6">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Aplicar filtros
              </button>

              <Link
                href="/dashboard/reports/sales-collections"
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Limpiar filtros
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Pedidos encontrados"
          value={totalOrders}
          description="Pedidos según los filtros aplicados."
        />

        <SummaryCard
          title="Monto estimado"
          value={formatMoney(estimatedAmount)}
          description="Suma del monto estimado de pedidos."
        />

        <SummaryCard
          title="Monto proformado"
          value={formatMoney(totalQuoted)}
          description="Suma de proformas emitidas."
        />

        <SummaryCard
          title="Total cobrado"
          value={formatMoney(totalPaid)}
          description="Adelantos iniciales, adelantos, amortizaciones y cancelaciones."
        />

        <SummaryCard
          title="Saldo pendiente"
          value={formatMoney(totalPendingBalance)}
          description={`Pedidos con saldo: ${pendingBalanceOrders}.`}
        />

        <SummaryCard
          title="Pedidos pagados"
          value={paidOrders}
          description="Pedidos con proforma sin saldo pendiente."
        />

        <SummaryCard
          title="Adelantos"
          value={formatMoney(totalInitialAdvances + totalAdvancePayments)}
          description="Adelantos iniciales y pagos tipo adelanto."
        />

        <SummaryCard
          title="Amortizaciones"
          value={formatMoney(totalAmortizations)}
          description={`Cancelaciones: ${formatMoney(totalCancellations)}.`}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado del reporte
          </CardTitle>
        </CardHeader>

        <CardContent>
          {reportRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron ventas o cobranzas con los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Pedido</th>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Estado pedido</th>
                    <th className="py-2 pr-3 font-medium">Monto estimado</th>
                    <th className="py-2 pr-3 font-medium">Proforma</th>
                    <th className="py-2 pr-3 font-medium">Monto proformado</th>
                    <th className="py-2 pr-3 font-medium">Adelantos</th>
                    <th className="py-2 pr-3 font-medium">Amortizaciones</th>
                    <th className="py-2 pr-3 font-medium">Cancelaciones</th>
                    <th className="py-2 pr-3 font-medium">Cobrado</th>
                    <th className="py-2 pr-3 font-medium">Saldo</th>
                    <th className="py-2 pr-3 font-medium">Cobranza</th>
                  </tr>
                </thead>

                <tbody>
                  {reportRows.map((row) => (
                    <tr key={row.order.id_pedido} className="border-b">
                      <td className="py-2 pr-3 font-medium">
                        <Link
                          href={`/dashboard/commercial/orders/${row.order.id_pedido}`}
                          className="hover:underline"
                        >
                          {row.order.id_pedido}
                        </Link>
                      </td>

                      <td className="py-2 pr-3">
                        <div>
                          <p className="font-medium">
                            {row.order.cliente.nombre_razon_social}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.order.cliente.tipo_cliente}
                          </p>
                        </div>
                      </td>

                      <td className="py-2 pr-3">
                        {formatDate(row.order.fecha_pedido)}
                      </td>

                      <td className="py-2 pr-3">
                        {getOrderStatusLabel(row.order.estado)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatMoney(row.order.monto_estimado)}
                      </td>

                      <td className="py-2 pr-3">
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
                      </td>

                      <td className="py-2 pr-3">
                        {formatMoney(row.quotedAmount)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatMoney(
                          row.initialAdvance + row.advancePayments,
                        )}
                      </td>

                      <td className="py-2 pr-3">
                        {formatMoney(row.amortizationPayments)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatMoney(row.cancellationPayments)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatMoney(row.totalPaid)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatMoney(row.pendingBalance)}
                      </td>

                      <td className="py-2 pr-3">
                        {getCollectionStatusLabel(row.collectionStatus)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
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