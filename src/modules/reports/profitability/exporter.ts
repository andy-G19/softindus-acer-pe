import "server-only";

import { formatDate, formatMoney } from "@/lib/formatters";
import {
  formatQuantity,
  getExportDateStamp,
  getExportParam,
  type ExportReport,
} from "@/modules/reports/export-report";
import { getProfitabilityExportRows } from "@/modules/reports/profitability/queries";

export async function exportProfitabilityReport(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  // Los mismos nombres que la URL de la pantalla, que genera este enlace
  // (grupo 4 de fixes: se retiran los alias dateFrom, dateTo y searchText,
  // que ninguna pantalla genera).
  const costings = await getProfitabilityExportRows(
    {
      q: getExportParam(searchParams, "q"),
      lowMargin: getExportParam(searchParams, "lowMargin"),
      negativeProfit: getExportParam(searchParams, "negativeProfit"),
      from: getExportParam(searchParams, "from"),
      to: getExportParam(searchParams, "to"),
    },
    limit,
  );

  return {
    filename: `costos_rentabilidad_${getExportDateStamp()}.xlsx`,
    pdfFilename: `costos_rentabilidad_${getExportDateStamp()}.pdf`,
    title: "Reporte de Costos y Rentabilidad",
    headers: [
      "Costeo",
      "Pedido",
      "Orden",
      "Cliente",
      "Producto",
      "Fecha",
      "Materiales",
      "Consumibles",
      "Mano de obra",
      "Indirectos",
      "Costo total",
      "Precio sugerido",
      "Precio final",
      "Ingreso",
      "Utilidad",
      "Margen real",
      "Estado",
    ],
    rows: costings.map((costing) => {
      const margin = costing.margen_ganancia[0];
      const profitability = costing.rentabilidad[0];

      return [
        costing.id_costeo,
        costing.id_pedido ?? "",
        costing.id_orden_trabajo ?? "",
        costing.pedido?.cliente.nombre_razon_social ??
          costing.orden_trabajo?.cliente?.nombre_razon_social ??
          "",
        costing.orden_trabajo?.producto.nombre_producto ?? "",
        formatDate(costing.fecha_costeo, { format: "dd/mm/yyyy" }),
        formatMoney(costing.costo_materiales),
        formatMoney(costing.costo_consumibles),
        formatMoney(costing.costo_mano_obra),
        formatMoney(costing.costo_indirecto_total),
        formatMoney(costing.costo_total),
        formatMoney(margin?.precio_sugerido ?? 0),
        formatMoney(margin?.precio_final ?? 0),
        formatMoney(profitability?.ingreso_estimado ?? 0),
        formatMoney(profitability?.utilidad_estimada ?? 0),
        `${formatQuantity(profitability?.margen_real)}%`,
        profitability?.alerta_bajo_margen ? "Margen bajo" : "Sin alerta",
      ];
    }),
  };
}
