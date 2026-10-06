import "server-only";

import type { ReportKey } from "@/lib/reports/report-registry";
import { exportAuditReport } from "@/modules/audit/exporter";
import { exportFinancialReport } from "@/modules/reports/financial/exporter";
import { exportInventoryReport } from "@/modules/reports/inventory/exporter";
import { exportMaintenanceReport } from "@/modules/reports/maintenance/exporter";
import { exportProductionReport } from "@/modules/reports/production/exporter";
import { exportProfitabilityReport } from "@/modules/reports/profitability/exporter";
import { exportSalesCollectionsReport } from "@/modules/reports/sales-collections/exporter";
import { exportStaffReport } from "@/modules/reports/staff/exporter";
import { exportSuppliersPurchasesReport } from "@/modules/reports/suppliers-purchases/exporter";
import type { ReportExporter } from "@/modules/reports/export-report";

// Registro de exportadores: uno por cada reporte de REPORT_REGISTRY. El tipo
// Record<ReportKey, ReportExporter> hace que TypeScript exija un exportador
// por clave, asi que un reporte nuevo sin exportador no compila. La ruta
// api/reports/export/[report] valida la clave, el rol, el formato y el rango
// antes de llamarlo.
export const REPORT_EXPORTERS: Record<ReportKey, ReportExporter> = {
  production: exportProductionReport,
  inventory: exportInventoryReport,
  "sales-collections": exportSalesCollectionsReport,
  "suppliers-purchases": exportSuppliersPurchasesReport,
  financial: exportFinancialReport,
  maintenance: exportMaintenanceReport,
  profitability: exportProfitabilityReport,
  staff: exportStaffReport,
  audit: exportAuditReport,
};
