import "server-only";

import { formatDateTime } from "@/lib/formatters";
import {
  formatQuantity,
  getExportDateStamp,
  getExportParam,
  type ExportReport,
} from "@/modules/reports/export-report";
import { getInventoryExportRows } from "@/modules/reports/inventory/queries";

export async function exportInventoryReport(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const movements = await getInventoryExportRows(
    {
      dateFrom: getExportParam(searchParams, "dateFrom"),
      dateTo: getExportParam(searchParams, "dateTo"),
      materialId: getExportParam(searchParams, "materialId"),
      movementType: getExportParam(searchParams, "movementType"),
      userId: getExportParam(searchParams, "userId"),
      workOrderCode: getExportParam(searchParams, "workOrderId").toUpperCase(),
    },
    limit,
  );

  return {
    filename: `reporte_inventario_${getExportDateStamp()}.xlsx`,
    pdfFilename: `reporte_inventario_${getExportDateStamp()}.pdf`,
    title: "Reporte de Inventario",
    headers: [
      "Movimiento",
      "Material",
      "Categoría",
      "Unidad",
      "Tipo movimiento",
      "Cantidad",
      "Stock anterior",
      "Stock resultante",
      "Fecha",
      "Responsable",
      "Orden de trabajo",
      "Producto orden",
      "Compra",
      "Proveedor",
      "Motivo",
    ],
    rows: movements.map((movement) => [
      movement.id_movimiento,
      movement.material.nombre_material,
      movement.material.categoria,
      movement.material.unidad_medida,
      movement.tipo_movimiento,
      formatQuantity(movement.cantidad),
      formatQuantity(movement.stock_anterior),
      formatQuantity(movement.stock_resultante),
      formatDateTime(movement.fecha_movimiento),
      `${movement.usuario.apellidos}, ${movement.usuario.nombres}`,
      movement.orden_trabajo?.id_orden_trabajo ?? "",
      movement.orden_trabajo?.producto.nombre_producto ?? "",
      movement.compra?.id_compra ?? "",
      movement.compra?.proveedor.razon_social ?? "",
      movement.motivo ?? "",
    ]),
  };
}
