import "server-only";

import { formatDate, formatMoney } from "@/lib/formatters";
import {
  getExportDateStamp,
  getExportParam,
  type ExportCell,
  type ExportReport,
} from "@/modules/reports/export-report";
import { summarizeFinancialTotals } from "@/modules/reports/financial/financial-totals";
import { getFinancialExportData } from "@/modules/reports/financial/queries";

export async function exportFinancialReport(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const {
    cashMovements,
    cashBalance,
    collectedPayments,
    productionCosts,
    estimatedProfit,
    receivables,
    cashIncomeSum,
    cashExpenseSum,
    pendingPurchaseAmounts,
  } = await getFinancialExportData(
    {
      dateFrom: getExportParam(searchParams, "dateFrom"),
      dateTo: getExportParam(searchParams, "dateTo"),
      cashBoxId: getExportParam(searchParams, "cashBoxId"),
      movementType: getExportParam(searchParams, "movementType"),
      categoryId: getExportParam(searchParams, "categoryId"),
      searchText: getExportParam(searchParams, "searchText"),
    },
    limit,
  );

  // C7 de la 11.4b (D52): los totales salen de todas las filas del filtro, no de las exportadas,
  // con la misma funcion que la pagina.
  const { totalCashIncome, totalCashExpense, cashNetMovement, pendingPurchasesBalance } =
    summarizeFinancialTotals({ cashIncomeSum, cashExpenseSum, pendingPurchaseAmounts });

  const summaryRows: ExportCell[][] = [
    ["Resumen", "Saldo caja chica abierta", "", formatMoney(cashBalance._sum.saldo_actual ?? 0), "", "", "", ""],
    ["Resumen", "Ingresos caja chica", "", formatMoney(totalCashIncome), "", "", "", ""],
    ["Resumen", "Egresos caja chica", "", formatMoney(totalCashExpense), "", "", "", ""],
    ["Resumen", "Movimiento neto caja", "", formatMoney(cashNetMovement), "", "", "", ""],
    ["Resumen", "Cobrado a clientes", "", formatMoney(collectedPayments._sum.monto_pagado ?? 0), "", "", "", ""],
    ["Resumen", "Costo producción", "", formatMoney(productionCosts._sum.costo_total ?? 0), "", "", "", ""],
    ["Resumen", "Ingreso estimado", "", formatMoney(estimatedProfit._sum.ingreso_estimado ?? 0), "", "", "", ""],
    ["Resumen", "Costo estimado", "", formatMoney(estimatedProfit._sum.costo_total ?? 0), "", "", "", ""],
    ["Resumen", "Utilidad estimada", "", formatMoney(estimatedProfit._sum.utilidad_estimada ?? 0), "", "", "", ""],
    ["Resumen", "Cuentas por cobrar", "", formatMoney(receivables._sum.saldo ?? 0), "", "", "", ""],
    ["Resumen", "Compras por pagar", "", formatMoney(pendingPurchasesBalance), "", "", "", ""],
  ];

  const movementRows: ExportCell[][] = cashMovements.map((movement) => [
    "Movimiento caja",
    movement.id_movimiento_caja,
    movement.concepto,
    formatMoney(movement.monto),
    formatDate(movement.fecha_movimiento, { format: "dd/mm/yyyy" }),
    movement.tipo_movimiento,
    movement.categoria_gasto?.nombre_categoria ?? "",
    movement.responsable ?? `${movement.usuario.apellidos}, ${movement.usuario.nombres}`,
  ]);

  return {
    filename: `reporte_financiero_${getExportDateStamp()}.xlsx`,
    pdfFilename: `reporte_financiero_${getExportDateStamp()}.pdf`,
    title: "Reporte Financiero",
    headers: [
      "Sección",
      "Código / Indicador",
      "Detalle",
      "Monto",
      "Fecha",
      "Tipo",
      "Categoría",
      "Responsable",
    ],
    rows: [...summaryRows, ...movementRows],
  };
}
