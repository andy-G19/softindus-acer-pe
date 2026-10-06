import "server-only";

import { formatDate, formatDateTime, formatMoney } from "@/lib/formatters";
import { toNumber } from "@/lib/numbers";
import {
  formatQuantity,
  getExportDateStamp,
  getExportParam,
  type ExportCell,
  type ExportReport,
} from "@/modules/reports/export-report";
import { getMaintenanceExportData } from "@/modules/reports/maintenance/queries";

export async function exportMaintenanceReport(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const { failures, preventives } = await getMaintenanceExportData(
    {
      dateFrom: getExportParam(searchParams, "dateFrom"),
      dateTo: getExportParam(searchParams, "dateTo"),
      machineId: getExportParam(searchParams, "machineId"),
      failureStatus: getExportParam(searchParams, "failureStatus"),
      repairStatus: getExportParam(searchParams, "repairStatus"),
      preventiveStatus: getExportParam(searchParams, "preventiveStatus"),
      searchText: getExportParam(searchParams, "searchText"),
    },
    limit,
  );

  const failureRows: ExportCell[][] = failures.map((failure) => {
    const repairCost = failure.reparacion.reduce((sum, repair) => {
      return sum + toNumber(repair.costo_total);
    }, 0);

    const spareParts = failure.reparacion
      .flatMap((repair) => repair.detalle_repuesto_reparacion)
      .map((detail) => {
        return `${detail.repuesto.nombre_repuesto}: ${formatQuantity(
          detail.cantidad,
        )} x ${formatMoney(detail.costo_unitario)}`;
      })
      .join(" | ");

    return [
      "Falla",
      failure.id_falla,
      failure.maquina.nombre,
      failure.maquina.tipo,
      formatDateTime(failure.fecha_falla),
      failure.estado_atencion,
      failure.descripcion,
      formatQuantity(failure.tiempo_perdido_horas),
      formatMoney(repairCost),
      spareParts,
      failure.responsable_registro ?? `${failure.usuario.apellidos}, ${failure.usuario.nombres}`,
    ];
  });

  const preventiveRows: ExportCell[][] = preventives.map((maintenance) => [
    "Preventivo",
    maintenance.id_mantenimiento,
    maintenance.maquina.nombre,
    maintenance.maquina.tipo,
    formatDate(maintenance.fecha_programada, { format: "dd/mm/yyyy" }),
    maintenance.estado,
    maintenance.actividad,
    "",
    "",
    "",
    maintenance.responsable ?? `${maintenance.usuario.apellidos}, ${maintenance.usuario.nombres}`,
  ]);

  return {
    filename: `reporte_mantenimiento_${getExportDateStamp()}.xlsx`,
    pdfFilename: `reporte_mantenimiento_${getExportDateStamp()}.pdf`,
    title: "Reporte de Mantenimiento",
    headers: [
      "Tipo registro",
      "Código",
      "Máquina",
      "Tipo máquina",
      "Fecha",
      "Estado",
      "Descripción / Actividad",
      "Tiempo perdido horas",
      "Costo",
      "Repuestos",
      "Responsable",
    ],
    rows: [...failureRows, ...preventiveRows],
  };
}
