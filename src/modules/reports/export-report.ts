import { toNumber } from "@/lib/numbers";
import { normalizeReportTextParam } from "@/lib/reports/report-filters";

// Contrato de los exportadores de reportes (entrega 5): cada reporte convierte
// los parametros de la URL en un titulo, encabezados y filas, y la ruta
// api/reports/export/[report] los entrega al generador de Excel o PDF.

export type ExportCell = string | number | boolean | Date | null | undefined;

export type ExportReport = {
  filename: string;
  pdfFilename: string;
  title: string;
  headers: string[];
  rows: ExportCell[][];
};

// `limit` ya viene acotado segun el formato (lib/reports/export-limits).
export type ReportExporter = (
  searchParams: URLSearchParams,
  limit: number,
) => Promise<ExportReport>;

export function getExportParam(searchParams: URLSearchParams, key: string) {
  return normalizeReportTextParam(searchParams.get(key));
}

export function formatQuantity(value: unknown) {
  return toNumber(value).toFixed(2);
}

export function getExportDateStamp() {
  return new Date().toISOString().slice(0, 10);
}
