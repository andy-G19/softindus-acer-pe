import "server-only";

import { formatDate, formatDateTime, formatMoney } from "@/lib/formatters";
import { toNumber } from "@/lib/numbers";
import {
  getExportDateStamp,
  getExportParam,
  type ExportReport,
} from "@/modules/reports/export-report";
import { getStaffExportRows } from "@/modules/reports/staff/queries";

export async function exportStaffReport(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const payrolls = await getStaffExportRows(
    {
      dateFrom: getExportParam(searchParams, "dateFrom") || getExportParam(searchParams, "from"),
      dateTo: getExportParam(searchParams, "dateTo") || getExportParam(searchParams, "to"),
      operatorId: getExportParam(searchParams, "operatorId") || getExportParam(searchParams, "operario"),
      payrollStatus: getExportParam(searchParams, "payrollStatus") || getExportParam(searchParams, "estado"),
      paymentMode: getExportParam(searchParams, "paymentMode") || getExportParam(searchParams, "modalidad"),
      searchText: getExportParam(searchParams, "q") || getExportParam(searchParams, "searchText"),
    },
    limit,
  );

  return {
    filename: `personal_planillas_${getExportDateStamp()}.xlsx`,
    pdfFilename: `personal_planillas_${getExportDateStamp()}.pdf`,
    title: "Reporte de Personal y Planillas",
    headers: [
      "Planilla",
      "Operario",
      "Modalidad",
      "Periodo inicio",
      "Periodo fin",
      "Monto bruto",
      "Descuentos",
      "Monto neto",
      "Monto pagado",
      "Estado",
      "Fecha generacion",
    ],
    rows: payrolls.map((payroll) => {
      const paidAmount = payroll.historial_pago_operario.reduce((sum, item) => {
        return sum + toNumber(item.monto_pagado);
      }, 0);

      return [
        payroll.id_planilla,
        `${payroll.operario.apellidos}, ${payroll.operario.nombres}`,
        payroll.modalidad_pago,
        formatDate(payroll.periodo_inicio, { format: "dd/mm/yyyy" }),
        formatDate(payroll.periodo_fin, { format: "dd/mm/yyyy" }),
        formatMoney(payroll.monto_bruto),
        formatMoney(payroll.descuentos),
        formatMoney(payroll.monto_neto),
        formatMoney(paidAmount),
        payroll.estado_pago,
        formatDateTime(payroll.fecha_generacion),
      ];
    }),
  };
}
