import "server-only";

import { formatDate } from "@/lib/formatters";
import { toNumber } from "@/lib/numbers";
import {
  formatQuantity,
  getExportDateStamp,
  getExportParam,
  type ExportReport,
} from "@/modules/reports/export-report";
import { getProductionExportRows } from "@/modules/reports/production/queries";

export async function exportProductionReport(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const orders = await getProductionExportRows(
    {
      dateFrom: getExportParam(searchParams, "dateFrom"),
      dateTo: getExportParam(searchParams, "dateTo"),
      productId: getExportParam(searchParams, "productId"),
      status: getExportParam(searchParams, "status"),
      orderCode: getExportParam(searchParams, "orderId").toUpperCase(),
    },
    limit,
  );

  return {
    filename: `reporte_produccion_${getExportDateStamp()}.xlsx`,
    pdfFilename: `reporte_produccion_${getExportDateStamp()}.pdf`,
    title: "Reporte de Producción",
    headers: [
      "Orden",
      "Producto",
      "Cliente",
      "Tipo producción",
      "Cantidad",
      "Fecha inicio",
      "Fecha entrega estimada",
      "Fecha entrega real",
      "Estado",
      "Prioridad",
      "Ruta",
      "Responsable",
      "Avance promedio",
      "Observaciones",
    ],
    rows: orders.map((order) => {
      const averageProgress =
        order.avance_orden.length === 0
          ? 0
          : order.avance_orden.reduce((sum, progress) => {
              return sum + toNumber(progress.porcentaje_avance);
            }, 0) / order.avance_orden.length;

      return [
        order.id_orden_trabajo,
        order.producto.nombre_producto,
        order.cliente?.nombre_razon_social ?? "",
        order.tipo_produccion,
        formatQuantity(order.cantidad),
        formatDate(order.fecha_inicio, { format: "dd/mm/yyyy" }),
        formatDate(order.fecha_entrega_estimada, { format: "dd/mm/yyyy", emptyText: "" }),
        formatDate(order.fecha_entrega_real, { format: "dd/mm/yyyy", emptyText: "" }),
        order.estado,
        order.prioridad,
        order.ruta_fabricacion?.nombre_ruta ?? "",
        `${order.usuario.apellidos}, ${order.usuario.nombres}`,
        `${averageProgress.toFixed(2)}%`,
        order.observaciones ?? "",
      ];
    }),
  };
}
