import "server-only";

import { formatDate, formatMoney } from "@/lib/formatters";
import { toNumber } from "@/lib/numbers";
import {
  formatQuantity,
  getExportDateStamp,
  getExportParam,
  type ExportReport,
} from "@/modules/reports/export-report";
import { getSuppliersPurchasesExportRows } from "@/modules/reports/suppliers-purchases/queries";

export async function exportSuppliersPurchasesReport(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const purchases = await getSuppliersPurchasesExportRows(
    {
      dateFrom: getExportParam(searchParams, "dateFrom"),
      dateTo: getExportParam(searchParams, "dateTo"),
      supplierId: getExportParam(searchParams, "supplierId"),
      materialId: getExportParam(searchParams, "materialId"),
      purchaseStatus: getExportParam(searchParams, "purchaseStatus"),
      paymentStatus: getExportParam(searchParams, "paymentStatus"),
      searchCode: getExportParam(searchParams, "searchCode").toUpperCase(),
    },
    limit,
  );

  return {
    filename: `reporte_proveedores_compras_${getExportDateStamp()}.xlsx`,
    pdfFilename: `reporte_proveedores_compras_${getExportDateStamp()}.pdf`,
    title: "Reporte de Proveedores y Compras",
    headers: [
      "Compra",
      "Proveedor",
      "Fecha compra",
      "Tipo comprobante",
      "Número comprobante",
      "Subtotal",
      "IGV",
      "Monto total",
      "Monto pagado",
      "Saldo pendiente",
      "Estado compra",
      "Estado pago",
      "Materiales comprados",
      "Precios históricos",
      "Usuario registro",
      "Observaciones",
    ],
    rows: purchases.map((purchase) => {
      const paidAmount = purchase.pago_proveedor.reduce((sum, payment) => {
        return sum + toNumber(payment.monto_pagado);
      }, 0);

      const pendingBalance = Math.max(
        toNumber(purchase.monto_total) - paidAmount,
        0,
      );

      const materialsText = purchase.detalle_compra
        .map((detail) => {
          return `${detail.material.nombre_material}: ${formatQuantity(
            detail.cantidad,
          )} ${detail.unidad_medida} x ${formatMoney(
            detail.costo_unitario,
          )} = ${formatMoney(detail.subtotal)}`;
        })
        .join(" | ");

      const historyText = purchase.historial_precio_proveedor
        .map((history) => {
          return `${history.material.nombre_material}: ${formatMoney(
            history.precio_unitario,
          )} (${formatDate(history.fecha_registro, { format: "dd/mm/yyyy" })})`;
        })
        .join(" | ");

      return [
        purchase.id_compra,
        purchase.proveedor.razon_social,
        formatDate(purchase.fecha_compra, { format: "dd/mm/yyyy" }),
        purchase.tipo_comprobante ?? "",
        purchase.numero_comprobante ?? "",
        formatMoney(purchase.subtotal),
        formatMoney(purchase.igv ?? 0),
        formatMoney(purchase.monto_total),
        formatMoney(paidAmount),
        formatMoney(pendingBalance),
        purchase.estado_compra,
        purchase.estado_pago,
        materialsText,
        historyText,
        `${purchase.usuario.apellidos}, ${purchase.usuario.nombres}`,
        purchase.observaciones ?? "",
      ];
    }),
  };
}
