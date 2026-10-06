import { requireApiAuth, type Role } from "@/lib/authz";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  toApiErrorResponse,
} from "@/lib/errors";
import { buildExcelBuffer, excelResponse } from "@/lib/excel-export";
import { buildPdfBuffer, pdfResponse } from "@/lib/pdf-export";
import {
  DEFAULT_PDF_DISPLAY_ROWS,
  MAX_EXCEL_EXPORT_ROWS,
  sanitizeExportFilename,
  type ExportFormat,
} from "@/lib/reports/export-limits";
import {
  parseExportFormat,
  parseExportLimit,
  parseReportDate,
  parseReportKey,
  validateDateRange,
} from "@/lib/reports/report-filters";
import { getReportDefinition } from "@/lib/reports/report-registry";
import { registerExportLog } from "@/modules/reports/export-log";
import {
  getExportParam,
  type ExportReport,
} from "@/modules/reports/export-report";
import { exportAuditReport } from "@/modules/audit/exporter";
import { exportProfitabilityReport } from "@/modules/reports/profitability/exporter";
import { exportStaffReport } from "@/modules/reports/staff/exporter";
import { exportMaintenanceReport } from "@/modules/reports/maintenance/exporter";
import { exportFinancialReport } from "@/modules/reports/financial/exporter";
import { exportSalesCollectionsReport } from "@/modules/reports/sales-collections/exporter";
import { exportSuppliersPurchasesReport } from "@/modules/reports/suppliers-purchases/exporter";
import { exportInventoryReport } from "@/modules/reports/inventory/exporter";
import { exportProductionReport } from "@/modules/reports/production/exporter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    report: string;
  }>;
};

async function buildReport(
  report: string,
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport | null> {
  switch (report) {
    case "production":
      return exportProductionReport(searchParams, limit);

    case "inventory":
      return exportInventoryReport(searchParams, limit);

    case "sales-collections":
      return exportSalesCollectionsReport(searchParams, limit);

    case "suppliers-purchases":
      return exportSuppliersPurchasesReport(searchParams, limit);

    case "financial":
      return exportFinancialReport(searchParams, limit);

    case "maintenance":
      return exportMaintenanceReport(searchParams, limit);

    case "profitability":
      return exportProfitabilityReport(searchParams, limit);

    case "staff":
      return exportStaffReport(searchParams, limit);

    case "audit":
      return exportAuditReport(searchParams, limit);

    default:
      return null;
  }
}

/** Lee dateFrom/dateTo o su alias from/to (usado por profitability/staff/audit). */
function extractReportDateRange(searchParams: URLSearchParams) {
  const fromRaw = getExportParam(searchParams, "dateFrom") || getExportParam(searchParams, "from");
  const toRaw = getExportParam(searchParams, "dateTo") || getExportParam(searchParams, "to");

  return {
    from: parseReportDate(fromRaw),
    to: parseReportDate(toRaw),
  };
}

function buildFiltersSummary(searchParams: URLSearchParams) {
  const entries = Array.from(searchParams.entries()).filter(
    ([key]) => key !== "fileFormat" && key !== "limit",
  );

  if (entries.length === 0) {
    return "Sin filtros aplicados";
  }

  return entries.map(([key, value]) => `${key}=${value}`).join(", ");
}

export async function GET(request: Request, context: RouteContext) {
  const { report: reportParam } = await context.params;
  const url = new URL(request.url);

  // 1) Autenticacion primero, sin importar si el reporte existe: nunca se
  // debe revelar la lista de reportes validos a una peticion sin sesion.
  const authResult = await requireApiAuth();

  if (!authResult.ok) {
    return authResult.response;
  }

  const { session } = authResult;

  // 2) El reporte debe existir en el registro central antes de ejecutar
  // cualquier consulta o revisar permisos especificos.
  const reportResult = parseReportKey(reportParam);

  if (!reportResult.ok) {
    return toApiErrorResponse(new NotFoundError(reportResult.error), {
      report: reportParam,
      userId: session.user.id,
    });
  }

  const report = reportResult.value;
  const definition = getReportDefinition(report);

  // 3) Rol permitido para este reporte especifico.
  if (!definition || !definition.allowedRoles.includes(session.user.role as Role)) {
    return toApiErrorResponse(new ForbiddenError(), {
      report,
      userId: session.user.id,
      role: session.user.role,
    });
  }

  // 4) Formato valido.
  const formatResult = parseExportFormat(url.searchParams.get("fileFormat"));

  if (!formatResult.ok) {
    return toApiErrorResponse(new ValidationError(formatResult.error), {
      report,
      userId: session.user.id,
    });
  }

  const fileFormat: ExportFormat = formatResult.value;

  // 5) Rango de fechas valido (si se envio).
  const { from, to } = extractReportDateRange(url.searchParams);
  const dateRangeResult = validateDateRange(from, to);

  if (!dateRangeResult.ok) {
    return toApiErrorResponse(new ValidationError(dateRangeResult.error), {
      report,
      userId: session.user.id,
    });
  }

  // 6) Limite seguro de filas segun formato (nunca ilimitado).
  const limit = parseExportLimit(url.searchParams.get("limit"), fileFormat);

  try {
    const exportReport = await buildReport(report, url.searchParams, limit);

    if (!exportReport) {
      return toApiErrorResponse(
        new NotFoundError(`Reporte no encontrado: "${report}".`),
        { report, userId: session.user.id },
      );
    }

    // Recorte defensivo final: algunos reportes combinan mas de una consulta
    // (ej. financiero = resumen + movimientos, mantenimiento = fallas +
    // preventivos), asi que el total podria superar levemente `limit`.
    const boundedRows = exportReport.rows.slice(0, MAX_EXCEL_EXPORT_ROWS);
    const totalAvailable = boundedRows.length;
    const filtersSummary = buildFiltersSummary(url.searchParams);

    if (fileFormat === "pdf") {
      const pdfRows = boundedRows.slice(0, DEFAULT_PDF_DISPLAY_ROWS);
      const truncated = totalAvailable > pdfRows.length;
      const pdfFilename = sanitizeExportFilename(exportReport.pdfFilename);

      await registerExportLog({
        userId: session.user.id,
        report,
        filename: pdfFilename,
        fileFormat: "pdf",
        searchParams: url.searchParams,
        totalExported: pdfRows.length,
      });

      const pdfBuffer = await buildPdfBuffer({
        title: exportReport.title,
        subtitle: "Sistema de Gestion Integral - Industrias Aceros Peru",
        note: truncated
          ? `Reporte limitado a ${pdfRows.length} de ${totalAvailable} registros por seguridad.`
          : undefined,
        headers: exportReport.headers,
        rows: pdfRows,
      });

      return pdfResponse(pdfBuffer, pdfFilename);
    }

    const excelFilename = sanitizeExportFilename(exportReport.filename);

    await registerExportLog({
      userId: session.user.id,
      report,
      filename: excelFilename,
      fileFormat: "excel",
      searchParams: url.searchParams,
      totalExported: boundedRows.length,
    });

    const excelBuffer = await buildExcelBuffer({
      title: exportReport.title,
      metadata: `Generado: ${new Date().toLocaleString("es-PE")} | Filtros: ${filtersSummary} | Total exportado: ${boundedRows.length} | Límite aplicado: ${limit}`,
      headers: exportReport.headers,
      rows: boundedRows,
    });

    return excelResponse(excelBuffer, excelFilename);
  } catch (error) {
    // toApiErrorResponse ya registra el error via logger (warn si es un
    // AppError operacional, error si no) y nunca expone el detalle real,
    // stack trace ni datos de conexion al cliente.
    return toApiErrorResponse(error, { report, fileFormat, userId: session.user.id });
  }
}
