import "server-only";

import { formatDateTime } from "@/lib/formatters";
import { getAuditLogExportRows } from "@/modules/audit/queries";
import {
  getExportDateStamp,
  getExportParam,
  type ExportReport,
} from "@/modules/reports/export-report";

export async function exportAuditReport(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const logs = await getAuditLogExportRows(
    {
      dateFrom: getExportParam(searchParams, "dateFrom") || getExportParam(searchParams, "from"),
      dateTo: getExportParam(searchParams, "dateTo") || getExportParam(searchParams, "to"),
      userId: getExportParam(searchParams, "userId") || getExportParam(searchParams, "usuario"),
      action: getExportParam(searchParams, "action") || getExportParam(searchParams, "accion"),
      entity: getExportParam(searchParams, "entity") || getExportParam(searchParams, "entidad"),
      searchText: getExportParam(searchParams, "q") || getExportParam(searchParams, "searchText"),
    },
    limit,
  );

  return {
    filename: `auditoria_${getExportDateStamp()}.xlsx`,
    pdfFilename: `auditoria_${getExportDateStamp()}.pdf`,
    title: "Reporte de Auditoria",
    headers: [
      "Fecha",
      "Usuario",
      "Accion",
      "Entidad",
      "Registro",
      "Detalle",
      "IP",
    ],
    rows: logs.map((log) => [
      formatDateTime(log.fecha_hora),
      `${log.usuario.apellidos}, ${log.usuario.nombres}`,
      log.accion,
      log.entidad_afectada,
      log.id_registro_afectado ?? "",
      log.detalle ?? "",
      log.ip_origen ?? "",
    ]),
  };
}
