import {
  MAX_DATE_RANGE_DAYS,
  clampExportLimit,
  type ExportFormat,
} from "@/lib/reports/export-limits";
import { isKnownReport, type ReportKey } from "@/lib/reports/report-registry";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MAX_QUERY_TEXT_LENGTH = 200;

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/**
 * Valida el nombre de reporte contra el registro central. Un reporte
 * desconocido nunca debe llegar a ejecutar una consulta.
 */
export function parseReportKey(report: string): ParseResult<ReportKey> {
  if (!isKnownReport(report)) {
    return { ok: false, error: `Reporte no encontrado: "${report}".` };
  }

  return { ok: true, value: report };
}

/**
 * Valida el formato de exportacion. Por compatibilidad con las URLs
 * actuales, la ausencia de `fileFormat` (o cualquier valor distinto de
 * "pdf") se sigue tratando como "excel", que es el comportamiento previo de
 * la ruta. Solo un valor explicito no reconocido (por ejemplo "xml") se
 * rechaza.
 */
export function parseExportFormat(
  value: string | null | undefined,
): ParseResult<ExportFormat> {
  const normalized = (value ?? "").trim().toLowerCase();

  if (normalized === "" || normalized === "excel") {
    return { ok: true, value: "excel" };
  }

  if (normalized === "pdf") {
    return { ok: true, value: "pdf" };
  }

  return {
    ok: false,
    error: `Formato de exportación no soportado: "${value}".`,
  };
}

/**
 * Valida un rango de fechas ya parseado: fechaDesde no puede ser mayor que
 * fechaHasta, y el rango no puede superar MAX_DATE_RANGE_DAYS.
 */
export function validateDateRange(
  from: Date | undefined,
  to: Date | undefined,
): ParseResult<true> {
  if (from && to) {
    if (from.getTime() > to.getTime()) {
      return {
        ok: false,
        error: "La fecha inicial no puede ser mayor que la fecha final.",
      };
    }

    const spanDays = (to.getTime() - from.getTime()) / MS_PER_DAY;

    if (spanDays > MAX_DATE_RANGE_DAYS) {
      return {
        ok: false,
        error: `El rango de fechas no puede superar ${MAX_DATE_RANGE_DAYS} días.`,
      };
    }
  }

  return { ok: true, value: true };
}

/**
 * Fecha de un filtro de reporte ("aaaa-mm-dd") a medianoche en la zona del
 * proceso. No valida el dia: "2026-02-30" pasa al 2 de marzo. Es la regla que
 * repetian las paginas de reportes y la ruta de exportacion.
 */
export function parseReportDate(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

/** Como parseReportDate, pero el dia siguiente: limite exclusivo de "hasta". */
export function parseReportDateAsNextDay(value: string): Date | undefined {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day + 1);
}

/**
 * Rango de un filtro "desde"/"hasta" de reporte: desde el inicio del primer
 * dia hasta antes del dia siguiente al ultimo. Sin fechas validas no filtra.
 */
export function buildReportDateRange(dateFrom: string, dateTo: string) {
  const fromDate = parseReportDate(dateFrom);
  const toDate = parseReportDateAsNextDay(dateTo);

  if (!fromDate && !toDate) {
    return undefined;
  }

  return {
    ...(fromDate ? { gte: fromDate } : {}),
    ...(toDate ? { lt: toDate } : {}),
  };
}

/**
 * Parsea el `limit` opcional de la URL y lo acota de forma segura segun el
 * formato de exportacion. Nunca deja pasar un valor enorme, negativo o NaN.
 */
export function parseExportLimit(
  value: string | null | undefined,
  format: ExportFormat,
): number {
  if (!value) {
    return clampExportLimit(undefined, format);
  }

  const parsed = Number.parseInt(value, 10);

  return clampExportLimit(Number.isFinite(parsed) ? parsed : undefined, format);
}

/**
 * Normaliza un parametro de texto libre (q, estado, tipo, etc.): recorta
 * espacios y limita la longitud para no construir un WHERE con un valor
 * absurdamente largo.
 */
export function normalizeReportTextParam(
  value: string | null | undefined,
): string {
  return (value ?? "").trim().slice(0, MAX_QUERY_TEXT_LENGTH);
}
