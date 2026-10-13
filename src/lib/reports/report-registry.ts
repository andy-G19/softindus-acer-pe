import { APP_ROLES, type AppRole } from "@/lib/permissions";

// Reportes reales soportados hoy por src/app/api/reports/export/[report]/route.ts.
// No se inventan reportes nuevos: esta es la misma lista de claves que ya
// existia repartida entre REPORT_MODULE_LABELS y REPORT_ALLOWED_ROLES en esa
// ruta, ahora centralizada en un solo lugar.
export const REPORT_KEYS = [
  "production",
  "inventory",
  "sales-collections",
  "suppliers-purchases",
  "financial",
  "maintenance",
  "profitability",
  "staff",
  "audit",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export type ReportDateParams = { from: string; to: string };

// Los nombres de fecha de la URL de un reporte: los que genera su pantalla y
// lee su exportador.
const DATE_FROM_TO: ReportDateParams = { from: "dateFrom", to: "dateTo" };
const FROM_TO: ReportDateParams = { from: "from", to: "to" };

export type ReportDefinition = {
  key: ReportKey;
  /** Nombre visible usado en el archivo exportado y en exportacion_datos.modulo_origen. */
  label: string;
  allowedRoles: AppRole[];
  supportsDateFilter: boolean;
  supportsSearch: boolean;
  /**
   * Parametros de fecha de la URL del reporte. La ruta de exportacion valida
   * el rango solo con ellos (grupo 4 de fixes): un nombre que el reporte no
   * lee no filtra ni se valida.
   */
  dateParams: ReportDateParams;
};

export const REPORT_REGISTRY: Record<ReportKey, ReportDefinition> = {
  production: {
    key: "production",
    label: "Reporte de producción",
    allowedRoles: [APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER],
    supportsDateFilter: true,
    supportsSearch: false,
    dateParams: DATE_FROM_TO,
  },
  inventory: {
    key: "inventory",
    label: "Reporte de inventario",
    allowedRoles: [APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER],
    supportsDateFilter: true,
    supportsSearch: false,
    dateParams: DATE_FROM_TO,
  },
  "sales-collections": {
    key: "sales-collections",
    label: "Reporte de ventas y cobranzas",
    allowedRoles: [APP_ROLES.ADMIN, APP_ROLES.SELLER],
    supportsDateFilter: true,
    supportsSearch: true,
    dateParams: DATE_FROM_TO,
  },
  "suppliers-purchases": {
    key: "suppliers-purchases",
    label: "Reporte de proveedores y compras",
    allowedRoles: [APP_ROLES.ADMIN],
    supportsDateFilter: true,
    supportsSearch: true,
    dateParams: DATE_FROM_TO,
  },
  financial: {
    key: "financial",
    label: "Reporte financiero",
    allowedRoles: [APP_ROLES.ADMIN],
    supportsDateFilter: true,
    supportsSearch: true,
    dateParams: DATE_FROM_TO,
  },
  maintenance: {
    key: "maintenance",
    label: "Reporte de mantenimiento",
    allowedRoles: [APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER],
    supportsDateFilter: true,
    supportsSearch: true,
    dateParams: DATE_FROM_TO,
  },
  profitability: {
    key: "profitability",
    label: "Reporte de costos y rentabilidad",
    allowedRoles: [APP_ROLES.ADMIN],
    supportsDateFilter: true,
    supportsSearch: true,
    dateParams: FROM_TO,
  },
  staff: {
    key: "staff",
    label: "Reporte de personal y planillas",
    allowedRoles: [APP_ROLES.ADMIN],
    supportsDateFilter: true,
    supportsSearch: true,
    dateParams: FROM_TO,
  },
  audit: {
    key: "audit",
    label: "Reporte de auditoria",
    allowedRoles: [APP_ROLES.ADMIN],
    supportsDateFilter: true,
    supportsSearch: true,
    dateParams: FROM_TO,
  },
};

export function isKnownReport(report: string): report is ReportKey {
  return Object.prototype.hasOwnProperty.call(REPORT_REGISTRY, report);
}

export function getReportDefinition(
  report: string,
): ReportDefinition | undefined {
  return isKnownReport(report) ? REPORT_REGISTRY[report] : undefined;
}

export function getReportAllowedRoles(report: string): AppRole[] {
  return getReportDefinition(report)?.allowedRoles ?? [];
}

export function getReportLabel(report: string): string {
  return getReportDefinition(report)?.label ?? report;
}
