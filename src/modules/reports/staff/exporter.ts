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
  // Los mismos nombres que la URL de la pantalla, que genera este enlace
  // (grupo 4 de fixes: se retiran los alias dateFrom, dateTo, operatorId,
  // payrollStatus, paymentMode y searchText, que ninguna pantalla genera).
  const payrolls = await getStaffExportRows(
    {
      q: getExportParam(searchParams, "q"),
      operario: getExportParam(searchParams, "operario"),
      modalidad: getExportParam(searchParams, "modalidad"),
      estado: getExportParam(searchParams, "estado"),
      from: getExportParam(searchParams, "from"),
      to: getExportParam(searchParams, "to"),
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
