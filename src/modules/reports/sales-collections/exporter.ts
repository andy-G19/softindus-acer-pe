import "server-only";

import { formatDate, formatMoney } from "@/lib/formatters";
import { toNumber } from "@/lib/numbers";
import {
  getExportDateStamp,
  getExportParam,
  type ExportReport,
} from "@/modules/reports/export-report";
import { getSalesCollectionsExportRows } from "@/modules/reports/sales-collections/queries";

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

export async function exportSalesCollectionsReport(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const collectionStatus = getExportParam(searchParams, "collectionStatus");

  const orders = await getSalesCollectionsExportRows(
    {
      dateFrom: getExportParam(searchParams, "dateFrom"),
      dateTo: getExportParam(searchParams, "dateTo"),
      clientId: getExportParam(searchParams, "clientId"),
      orderStatus: getExportParam(searchParams, "orderStatus"),
      searchCode: getExportParam(searchParams, "searchCode").toUpperCase(),
    },
    limit,
  );

  const rows = orders
    .map((order) => {
      const quote = order.proforma[0] ?? null;
      const payments = quote?.pago_cliente ?? [];

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

      const currentCollectionStatus = !quote
        ? "sin_proforma"
        : totalPaid <= 0 && pendingBalance > 0
          ? "sin_pago"
          : pendingBalance > 0
            ? "con_saldo"
            : "pagado";

      return {
        order,
        quote,
        initialAdvance,
        advancePayments,
        amortizationPayments,
        cancellationPayments,
        totalPaid,
        pendingBalance,
        currentCollectionStatus,
      };
    })
    .filter((row) => {
      if (!collectionStatus) {
        return true;
      }

      return row.currentCollectionStatus === collectionStatus;
    });

  return {
    filename: `reporte_ventas_cobranzas_${getExportDateStamp()}.xlsx`,
    pdfFilename: `reporte_ventas_cobranzas_${getExportDateStamp()}.pdf`,
    title: "Reporte de Ventas y Cobranzas",
    headers: [
      "Pedido",
      "Cliente",
      "Fecha pedido",
      "Estado pedido",
      "Monto estimado",
      "Proforma",
      "Fecha proforma",
      "Estado proforma",
      "Monto proformado",
      "Adelanto inicial",
      "Pagos adelanto",
      "Amortizaciones",
      "Cancelaciones",
      "Total cobrado",
      "Saldo pendiente",
      "Estado cobranza",
      "Comprobantes",
    ],
    rows: rows.map((row) => [
      row.order.id_pedido,
      row.order.cliente.nombre_razon_social,
      formatDate(row.order.fecha_pedido, { format: "dd/mm/yyyy" }),
      row.order.estado,
      formatMoney(row.order.monto_estimado ?? 0),
      row.quote?.numero_proforma ?? "",
      formatDate(row.quote?.fecha_emision, { format: "dd/mm/yyyy", emptyText: "" }),
      row.quote?.estado ?? "",
      formatMoney(row.quote?.monto_total ?? 0),
      formatMoney(row.initialAdvance),
      formatMoney(row.advancePayments),
      formatMoney(row.amortizationPayments),
      formatMoney(row.cancellationPayments),
      formatMoney(row.totalPaid),
      formatMoney(row.pendingBalance),
      row.currentCollectionStatus,
      row.quote?.comprobante_venta
        .map((receipt) => receipt.numero_comprobante)
        .join(" | ") ?? "",
    ]),
  };
}
