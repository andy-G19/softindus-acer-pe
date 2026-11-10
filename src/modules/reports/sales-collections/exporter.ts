import "server-only";

import { formatDate, formatMoney } from "@/lib/formatters";
import {
  getExportDateStamp,
  getExportParam,
  type ExportReport,
} from "@/modules/reports/export-report";
import {
  getCollectionSummary,
  matchesCollectionStatus,
} from "@/modules/reports/sales-collections/collection-status";
import { getSalesCollectionsExportRows } from "@/modules/reports/sales-collections/queries";

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

      return { order, quote, ...getCollectionSummary(quote) };
    })
    .filter((row) => matchesCollectionStatus(row.collectionStatus, collectionStatus));

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
      row.collectionStatus,
      row.quote?.comprobante_venta
        .map((receipt) => receipt.numero_comprobante)
        .join(" | ") ?? "",
    ]),
  };
}
