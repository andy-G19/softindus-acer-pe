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
  // Los mismos nombres que la URL de la pantalla, que genera este enlace
  // (grupo 4 de fixes: se retiran los alias dateFrom, dateTo, userId, action,
  // entity y searchText, que ninguna pantalla genera).
  const logs = await getAuditLogExportRows(
    {
      q: getExportParam(searchParams, "q"),
      usuario: getExportParam(searchParams, "usuario"),
      accion: getExportParam(searchParams, "accion"),
      entidad: getExportParam(searchParams, "entidad"),
      from: getExportParam(searchParams, "from"),
      to: getExportParam(searchParams, "to"),
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
