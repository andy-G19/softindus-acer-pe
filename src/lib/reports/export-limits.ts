// Limites de seguridad para exportaciones de reportes. Constantes puras: sin
// variables de entorno, sin dependencias externas, testeables sin BD.
//
// No se agregaron variables de entorno para estos limites: son valores de
// negocio (cuantas filas es razonable exportar), no configuracion de
// despliegue, y mantenerlos como constantes evita que alguien los suba a un
// valor inseguro sin pasar por revision de codigo.

export type ExportFormat = "pdf" | "excel";

/** Limite superior de filas que puede traer la consulta para un Excel. */
export const MAX_EXCEL_EXPORT_ROWS = 5000;

/**
 * Limite superior de filas que puede traer la consulta cuando el formato es
 * PDF. Es mas alto que lo que realmente se dibuja (ver
 * DEFAULT_PDF_DISPLAY_ROWS) para dejar margen si en el futuro el render de
 * PDF soporta mas paginas sin cambiar este archivo.
 */
export const MAX_PDF_EXPORT_ROWS = 500;

/**
 * Filas que efectivamente se dibujan en el PDF. Ya se usaba `slice(0, 80)`
 * en la ruta de exportacion; se centraliza aqui con el mismo valor para no
 * cambiar el comportamiento visible.
 */
export const DEFAULT_PDF_DISPLAY_ROWS = 80;

/** Limite por defecto cuando no se pide un `limit` explicito por query. */
export const DEFAULT_EXPORT_LIMIT = 1000;

/** Rango maximo de dias permitido entre fechaDesde y fechaHasta. */
export const MAX_DATE_RANGE_DAYS = 366;

/** Rango de dias sugerido cuando no se indican fechas (uso solo informativo). */
export const DEFAULT_DATE_RANGE_DAYS = 90;

/** Limite superior de filas segun el formato de exportacion. */
export function getMaxRowsForFormat(format: ExportFormat): number {
  return format === "pdf" ? MAX_PDF_EXPORT_ROWS : MAX_EXCEL_EXPORT_ROWS;
}

/**
 * Calcula el `take` seguro a usar en la consulta Prisma: nunca menor a 1 ni
 * mayor al maximo del formato. Un valor invalido, negativo, NaN o ausente
 * cae al default (acotado tambien al maximo del formato).
 */
export function clampExportLimit(
  requested: number | undefined,
  format: ExportFormat,
): number {
  const max = getMaxRowsForFormat(format);

  if (
    requested === undefined ||
    !Number.isFinite(requested) ||
    requested <= 0
  ) {
    return Math.min(DEFAULT_EXPORT_LIMIT, max);
  }

  return Math.min(Math.floor(requested), max);
}

/**
 * Sanitiza un nombre de archivo para uso seguro en el header
 * Content-Disposition: solo letras, numeros, punto, guion y guion bajo.
 * Evita inyeccion de headers (CR/LF) y caracteres que rompan el nombre de
 * archivo en distintos sistemas operativos/navegadores.
 */
export function sanitizeExportFilename(filename: string): string {
  const sanitized = filename
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 150);

  return sanitized || "reporte";
}
