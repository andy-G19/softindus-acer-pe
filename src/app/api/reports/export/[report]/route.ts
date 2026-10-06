import { requireApiAuth, type Role } from "@/lib/authz";
import { prisma } from "@/lib/db";
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  toApiErrorResponse,
} from "@/lib/errors";
import { buildExcelBuffer, excelResponse } from "@/lib/excel-export";
import { formatDate, formatDateTime, formatMoney } from "@/lib/formatters";
import { toNumber } from "@/lib/numbers";
import { buildPdfBuffer, pdfResponse } from "@/lib/pdf-export";
import {
  DEFAULT_PDF_DISPLAY_ROWS,
  MAX_EXCEL_EXPORT_ROWS,
  sanitizeExportFilename,
  type ExportFormat,
} from "@/lib/reports/export-limits";
import {
  buildReportDateRange,
  parseExportFormat,
  parseExportLimit,
  parseReportDate,
  parseReportKey,
  validateDateRange,
} from "@/lib/reports/report-filters";
import { getReportDefinition } from "@/lib/reports/report-registry";
import { registerExportLog } from "@/modules/reports/export-log";
import {
  formatQuantity,
  getExportDateStamp,
  getExportParam,
  type ExportCell,
  type ExportReport,
} from "@/modules/reports/export-report";
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

function getPaymentTotalByType(
  payments: {
    tipo_pago: string;
    monto_pagado: unknown;
  }[],
  type: string,
) {
  return payments.reduce((sum, payment) => {
    if (payment.tipo_pago !== type) {
      return sum;
    }

    return sum + toNumber(payment.monto_pagado);
  }, 0);
}

async function buildSalesCollectionsCsv(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const dateFrom = getExportParam(searchParams, "dateFrom");
  const dateTo = getExportParam(searchParams, "dateTo");
  const clientId = getExportParam(searchParams, "clientId");
  const orderStatus = getExportParam(searchParams, "orderStatus");
  const collectionStatus = getExportParam(searchParams, "collectionStatus");
  const searchCode = getExportParam(searchParams, "searchCode").toUpperCase();

  const dateRange = buildReportDateRange(dateFrom, dateTo);

  const orders = await prisma.pedido.findMany({
    where: {
      ...(dateRange ? { fecha_pedido: dateRange } : {}),
      ...(clientId ? { id_cliente: clientId } : {}),
      ...(orderStatus ? { estado: orderStatus } : {}),
      ...(searchCode
        ? {
            OR: [
              {
                id_pedido: {
                  contains: searchCode,
                },
              },
              {
                proforma: {
                  some: {
                    OR: [
                      {
                        id_proforma: {
                          contains: searchCode,
                        },
                      },
                      {
                        numero_proforma: {
                          contains: searchCode,
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ fecha_pedido: "desc" }, { id_pedido: "desc" }],
    take: limit,
    include: {
      cliente: true,
      proforma: {
        orderBy: {
          fecha_emision: "desc",
        },
        include: {
          pago_cliente: true,
          comprobante_venta: true,
        },
      },
    },
  });

  const rows = orders
    .map((order) => {
      const quote = order.proforma[0] ?? null;
      const payments = quote?.pago_cliente ?? [];

      const initialAdvance = toNumber(quote?.adelanto_inicial);
      const advancePayments = getPaymentTotalByType(payments, "adelanto");
      const amortizationPayments = getPaymentTotalByType(
        payments,
        "amortizacion",
      );
      const cancellationPayments = getPaymentTotalByType(
        payments,
        "cancelacion",
      );

      const totalPaid =
        initialAdvance +
        advancePayments +
        amortizationPayments +
        cancellationPayments;

      const pendingBalance = quote ? toNumber(quote.saldo) : 0;

      const currentCollectionStatus = !quote
        ? "sin_proforma"
        : totalPaid <= 0 && pendingBalance > 0
          ? "sin_pago"
          : pendingBalance > 0
            ? "con_saldo"
            : "pagado";

      return {
        order,
        quote,
        initialAdvance,
        advancePayments,
        amortizationPayments,
        cancellationPayments,
        totalPaid,
        pendingBalance,
        currentCollectionStatus,
      };
    })
    .filter((row) => {
      if (!collectionStatus) {
        return true;
      }

      return row.currentCollectionStatus === collectionStatus;
    });

  return {
    filename: `reporte_ventas_cobranzas_${getExportDateStamp()}.xlsx`,
    pdfFilename: `reporte_ventas_cobranzas_${getExportDateStamp()}.pdf`,
    title: "Reporte de Ventas y Cobranzas",
    headers: [
      "Pedido",
      "Cliente",
      "Fecha pedido",
      "Estado pedido",
      "Monto estimado",
      "Proforma",
      "Fecha proforma",
      "Estado proforma",
      "Monto proformado",
      "Adelanto inicial",
      "Pagos adelanto",
      "Amortizaciones",
      "Cancelaciones",
      "Total cobrado",
      "Saldo pendiente",
      "Estado cobranza",
      "Comprobantes",
    ],
    rows: rows.map((row) => [
      row.order.id_pedido,
      row.order.cliente.nombre_razon_social,
      formatDate(row.order.fecha_pedido, { format: "dd/mm/yyyy" }),
      row.order.estado,
      formatMoney(row.order.monto_estimado ?? 0),
      row.quote?.numero_proforma ?? "",
      formatDate(row.quote?.fecha_emision, { format: "dd/mm/yyyy", emptyText: "" }),
      row.quote?.estado ?? "",
      formatMoney(row.quote?.monto_total ?? 0),
      formatMoney(row.initialAdvance),
      formatMoney(row.advancePayments),
      formatMoney(row.amortizationPayments),
      formatMoney(row.cancellationPayments),
      formatMoney(row.totalPaid),
      formatMoney(row.pendingBalance),
      row.currentCollectionStatus,
      row.quote?.comprobante_venta
        .map((receipt) => receipt.numero_comprobante)
        .join(" | ") ?? "",
    ]),
  };
}

async function buildFinancialCsv(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const dateFrom = getExportParam(searchParams, "dateFrom");
  const dateTo = getExportParam(searchParams, "dateTo");
  const cashBoxId = getExportParam(searchParams, "cashBoxId");
  const movementType = getExportParam(searchParams, "movementType");
  const categoryId = getExportParam(searchParams, "categoryId");
  const searchText = getExportParam(searchParams, "searchText");

  const dateRange = buildReportDateRange(dateFrom, dateTo);

  const [
    cashMovements,
    cashBalance,
    collectedPayments,
    productionCosts,
    estimatedProfit,
    receivables,
    pendingPurchases,
  ] = await Promise.all([
    prisma.movimiento_caja.findMany({
      where: {
        ...(dateRange ? { fecha_movimiento: dateRange } : {}),
        ...(cashBoxId ? { id_caja_chica: cashBoxId } : {}),
        ...(movementType ? { tipo_movimiento: movementType } : {}),
        ...(categoryId ? { id_categoria_gasto: categoryId } : {}),
        ...(searchText
          ? {
              OR: [
                {
                  concepto: {
                    contains: searchText,
                    mode: "insensitive" as const,
                  },
                },
                {
                  responsable: {
                    contains: searchText,
                    mode: "insensitive" as const,
                  },
                },
                {
                  comprobante: {
                    contains: searchText,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ fecha_movimiento: "desc" }, { id_movimiento_caja: "desc" }],
      take: limit,
      include: {
        caja_chica: true,
        categoria_gasto: true,
        usuario: true,
      },
    }),

    prisma.caja_chica.aggregate({
      where: {
        estado: "abierta",
      },
      _sum: {
        saldo_actual: true,
      },
    }),

    prisma.pago_cliente.aggregate({
      where: {
        ...(dateRange ? { fecha_pago: dateRange } : {}),
      },
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.costeo.aggregate({
      where: {
        ...(dateRange ? { fecha_costeo: dateRange } : {}),
      },
      _sum: {
        costo_total: true,
      },
    }),

    prisma.rentabilidad.aggregate({
      where: {
        ...(dateRange ? { fecha_calculo: dateRange } : {}),
      },
      _sum: {
        ingreso_estimado: true,
        costo_total: true,
        utilidad_estimada: true,
      },
    }),

    prisma.proforma.aggregate({
      where: {
        estado: {
          in: ["vigente", "aceptada"],
        },
        saldo: {
          gt: 0,
        },
        ...(dateRange ? { fecha_emision: dateRange } : {}),
      },
      _sum: {
        saldo: true,
      },
    }),

    prisma.compra.findMany({
      where: {
        estado_pago: {
          in: ["pendiente", "parcial"],
        },
        estado_compra: {
          not: "anulada",
        },
        ...(dateRange ? { fecha_compra: dateRange } : {}),
      },
      orderBy: [{ fecha_compra: "desc" }, { id_compra: "desc" }],
      // No son las filas exportadas (son insumo de un total agregado en
      // memoria), pero igual se acota: evita cargar todas las compras
      // pendientes de pago sin limite si la tabla crece mucho.
      take: limit,
      include: {
        proveedor: true,
        pago_proveedor: true,
      },
    }),
  ]);

  const totalCashIncome = cashMovements.reduce((sum, movement) => {
    if (movement.tipo_movimiento !== "ingreso") {
      return sum;
    }

    return sum + toNumber(movement.monto);
  }, 0);

  const totalCashExpense = cashMovements.reduce((sum, movement) => {
    if (movement.tipo_movimiento !== "egreso") {
      return sum;
    }

    return sum + toNumber(movement.monto);
  }, 0);

  const totalPendingPurchases = pendingPurchases.reduce((sum, purchase) => {
    const paid = purchase.pago_proveedor.reduce((paymentSum, payment) => {
      return paymentSum + toNumber(payment.monto_pagado);
    }, 0);

    return sum + Math.max(toNumber(purchase.monto_total) - paid, 0);
  }, 0);

  const summaryRows: ExportCell[][] = [
    ["Resumen", "Saldo caja chica abierta", "", formatMoney(cashBalance._sum.saldo_actual ?? 0), "", "", "", ""],
    ["Resumen", "Ingresos caja chica", "", formatMoney(totalCashIncome), "", "", "", ""],
    ["Resumen", "Egresos caja chica", "", formatMoney(totalCashExpense), "", "", "", ""],
    ["Resumen", "Movimiento neto caja", "", formatMoney(totalCashIncome - totalCashExpense), "", "", "", ""],
    ["Resumen", "Cobrado a clientes", "", formatMoney(collectedPayments._sum.monto_pagado ?? 0), "", "", "", ""],
    ["Resumen", "Costo producción", "", formatMoney(productionCosts._sum.costo_total ?? 0), "", "", "", ""],
    ["Resumen", "Ingreso estimado", "", formatMoney(estimatedProfit._sum.ingreso_estimado ?? 0), "", "", "", ""],
    ["Resumen", "Costo estimado", "", formatMoney(estimatedProfit._sum.costo_total ?? 0), "", "", "", ""],
    ["Resumen", "Utilidad estimada", "", formatMoney(estimatedProfit._sum.utilidad_estimada ?? 0), "", "", "", ""],
    ["Resumen", "Cuentas por cobrar", "", formatMoney(receivables._sum.saldo ?? 0), "", "", "", ""],
    ["Resumen", "Compras por pagar", "", formatMoney(totalPendingPurchases), "", "", "", ""],
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

async function buildMaintenanceCsv(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const dateFrom = getExportParam(searchParams, "dateFrom");
  const dateTo = getExportParam(searchParams, "dateTo");
  const machineId = getExportParam(searchParams, "machineId");
  const failureStatus = getExportParam(searchParams, "failureStatus");
  const repairStatus = getExportParam(searchParams, "repairStatus");
  const preventiveStatus = getExportParam(searchParams, "preventiveStatus");
  const searchText = getExportParam(searchParams, "searchText");

  const dateRange = buildReportDateRange(dateFrom, dateTo);

  const [failures, preventives] = await Promise.all([
    prisma.falla_maquina.findMany({
      where: {
        ...(dateRange ? { fecha_falla: dateRange } : {}),
        ...(machineId ? { id_maquina: machineId } : {}),
        ...(failureStatus ? { estado_atencion: failureStatus } : {}),
        ...(repairStatus
          ? {
              reparacion: {
                some: {
                  estado_reparacion: repairStatus,
                },
              },
            }
          : {}),
        ...(searchText
          ? {
              OR: [
                {
                  descripcion: {
                    contains: searchText,
                    mode: "insensitive" as const,
                  },
                },
                {
                  responsable_registro: {
                    contains: searchText,
                    mode: "insensitive" as const,
                  },
                },
                {
                  impacto_produccion: {
                    contains: searchText,
                    mode: "insensitive" as const,
                  },
                },
                {
                  maquina: {
                    nombre: {
                      contains: searchText,
                      mode: "insensitive" as const,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ fecha_falla: "desc" }, { id_falla: "desc" }],
      // La lista final combina fallas + preventivos: se acota cada consulta
      // al limite completo (el total combinado se vuelve a recortar al
      // armar el reporte final).
      take: limit,
      include: {
        maquina: true,
        usuario: true,
        reparacion: {
          include: {
            detalle_repuesto_reparacion: {
              include: {
                repuesto: true,
              },
            },
          },
        },
      },
    }),

    prisma.mantenimiento_preventivo.findMany({
      where: {
        ...(dateRange ? { fecha_programada: dateRange } : {}),
        ...(machineId ? { id_maquina: machineId } : {}),
        ...(preventiveStatus ? { estado: preventiveStatus } : {}),
      },
      orderBy: [{ fecha_programada: "asc" }, { id_mantenimiento: "desc" }],
      take: limit,
      include: {
        maquina: true,
        usuario: true,
      },
    }),
  ]);

  const failureRows: ExportCell[][] = failures.map((failure) => {
    const repairCost = failure.reparacion.reduce((sum, repair) => {
      return sum + toNumber(repair.costo_total);
    }, 0);

    const spareParts = failure.reparacion
      .flatMap((repair) => repair.detalle_repuesto_reparacion)
      .map((detail) => {
        return `${detail.repuesto.nombre_repuesto}: ${formatQuantity(
          detail.cantidad,
        )} x ${formatMoney(detail.costo_unitario)}`;
      })
      .join(" | ");

    return [
      "Falla",
      failure.id_falla,
      failure.maquina.nombre,
      failure.maquina.tipo,
      formatDateTime(failure.fecha_falla),
      failure.estado_atencion,
      failure.descripcion,
      formatQuantity(failure.tiempo_perdido_horas),
      formatMoney(repairCost),
      spareParts,
      failure.responsable_registro ?? `${failure.usuario.apellidos}, ${failure.usuario.nombres}`,
    ];
  });

  const preventiveRows: ExportCell[][] = preventives.map((maintenance) => [
    "Preventivo",
    maintenance.id_mantenimiento,
    maintenance.maquina.nombre,
    maintenance.maquina.tipo,
    formatDate(maintenance.fecha_programada, { format: "dd/mm/yyyy" }),
    maintenance.estado,
    maintenance.actividad,
    "",
    "",
    "",
    maintenance.responsable ?? `${maintenance.usuario.apellidos}, ${maintenance.usuario.nombres}`,
  ]);

  return {
    filename: `reporte_mantenimiento_${getExportDateStamp()}.xlsx`,
    pdfFilename: `reporte_mantenimiento_${getExportDateStamp()}.pdf`,
    title: "Reporte de Mantenimiento",
    headers: [
      "Tipo registro",
      "Código",
      "Máquina",
      "Tipo máquina",
      "Fecha",
      "Estado",
      "Descripción / Actividad",
      "Tiempo perdido horas",
      "Costo",
      "Repuestos",
      "Responsable",
    ],
    rows: [...failureRows, ...preventiveRows],
  };
}

async function buildProfitabilityCsv(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const dateFrom = getExportParam(searchParams, "dateFrom") || getExportParam(searchParams, "from");
  const dateTo = getExportParam(searchParams, "dateTo") || getExportParam(searchParams, "to");
  const searchText = getExportParam(searchParams, "q") || getExportParam(searchParams, "searchText");
  const lowMargin = getExportParam(searchParams, "lowMargin");
  const negativeProfit = getExportParam(searchParams, "negativeProfit");
  const dateRange = buildReportDateRange(dateFrom, dateTo);

  const costings = await prisma.costeo.findMany({
    where: {
      ...(dateRange ? { fecha_costeo: dateRange } : {}),
      ...(searchText
        ? {
            OR: [
              { id_costeo: { contains: searchText, mode: "insensitive" } },
              { id_pedido: { contains: searchText, mode: "insensitive" } },
              { id_orden_trabajo: { contains: searchText, mode: "insensitive" } },
              {
                pedido: {
                  cliente: {
                    nombre_razon_social: {
                      contains: searchText,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                orden_trabajo: {
                  producto: {
                    nombre_producto: {
                      contains: searchText,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
      ...(lowMargin === "true"
        ? { rentabilidad: { some: { alerta_bajo_margen: true } } }
        : {}),
      ...(negativeProfit === "true"
        ? { rentabilidad: { some: { utilidad_estimada: { lt: 0 } } } }
        : {}),
    },
    orderBy: [{ fecha_costeo: "desc" }, { id_costeo: "desc" }],
    take: limit,
    include: {
      pedido: {
        include: {
          cliente: true,
        },
      },
      orden_trabajo: {
        include: {
          producto: true,
          cliente: true,
        },
      },
      margen_ganancia: {
        orderBy: {
          fecha_aplicacion: "desc",
        },
        take: 1,
      },
      rentabilidad: {
        orderBy: {
          fecha_calculo: "desc",
        },
        take: 1,
      },
    },
  });

  return {
    filename: `costos_rentabilidad_${getExportDateStamp()}.xlsx`,
    pdfFilename: `costos_rentabilidad_${getExportDateStamp()}.pdf`,
    title: "Reporte de Costos y Rentabilidad",
    headers: [
      "Costeo",
      "Pedido",
      "Orden",
      "Cliente",
      "Producto",
      "Fecha",
      "Materiales",
      "Consumibles",
      "Mano de obra",
      "Indirectos",
      "Costo total",
      "Precio sugerido",
      "Precio final",
      "Ingreso",
      "Utilidad",
      "Margen real",
      "Estado",
    ],
    rows: costings.map((costing) => {
      const margin = costing.margen_ganancia[0];
      const profitability = costing.rentabilidad[0];

      return [
        costing.id_costeo,
        costing.id_pedido ?? "",
        costing.id_orden_trabajo ?? "",
        costing.pedido?.cliente.nombre_razon_social ??
          costing.orden_trabajo?.cliente?.nombre_razon_social ??
          "",
        costing.orden_trabajo?.producto.nombre_producto ?? "",
        formatDate(costing.fecha_costeo, { format: "dd/mm/yyyy" }),
        formatMoney(costing.costo_materiales),
        formatMoney(costing.costo_consumibles),
        formatMoney(costing.costo_mano_obra),
        formatMoney(costing.costo_indirecto_total),
        formatMoney(costing.costo_total),
        formatMoney(margin?.precio_sugerido ?? 0),
        formatMoney(margin?.precio_final ?? 0),
        formatMoney(profitability?.ingreso_estimado ?? 0),
        formatMoney(profitability?.utilidad_estimada ?? 0),
        `${formatQuantity(profitability?.margen_real)}%`,
        profitability?.alerta_bajo_margen ? "Margen bajo" : "Sin alerta",
      ];
    }),
  };
}

async function buildStaffCsv(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const dateFrom = getExportParam(searchParams, "dateFrom") || getExportParam(searchParams, "from");
  const dateTo = getExportParam(searchParams, "dateTo") || getExportParam(searchParams, "to");
  const operatorId = getExportParam(searchParams, "operatorId") || getExportParam(searchParams, "operario");
  const payrollStatus = getExportParam(searchParams, "payrollStatus") || getExportParam(searchParams, "estado");
  const paymentMode = getExportParam(searchParams, "paymentMode") || getExportParam(searchParams, "modalidad");
  const searchText = getExportParam(searchParams, "q") || getExportParam(searchParams, "searchText");
  const dateRange = buildReportDateRange(dateFrom, dateTo);

  const payrolls = await prisma.planilla_pago.findMany({
    where: {
      ...(operatorId ? { id_operario: operatorId } : {}),
      ...(payrollStatus ? { estado_pago: payrollStatus } : {}),
      ...(paymentMode ? { modalidad_pago: paymentMode } : {}),
      ...(dateRange ? { periodo_inicio: dateRange } : {}),
      ...(searchText
        ? {
            operario: {
              OR: [
                { nombres: { contains: searchText, mode: "insensitive" } },
                { apellidos: { contains: searchText, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: [{ fecha_generacion: "desc" }, { id_planilla: "desc" }],
    take: limit,
    include: {
      operario: true,
      historial_pago_operario: true,
    },
  });

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

async function buildAuditCsv(
  searchParams: URLSearchParams,
  limit: number,
): Promise<ExportReport> {
  const dateFrom = getExportParam(searchParams, "dateFrom") || getExportParam(searchParams, "from");
  const dateTo = getExportParam(searchParams, "dateTo") || getExportParam(searchParams, "to");
  const userId = getExportParam(searchParams, "userId") || getExportParam(searchParams, "usuario");
  const action = getExportParam(searchParams, "action") || getExportParam(searchParams, "accion");
  const entity = getExportParam(searchParams, "entity") || getExportParam(searchParams, "entidad");
  const searchText = getExportParam(searchParams, "q") || getExportParam(searchParams, "searchText");
  const dateRange = buildReportDateRange(dateFrom, dateTo);

  const logs = await prisma.bitacora_operacion.findMany({
    where: {
      ...(dateRange ? { fecha_hora: dateRange } : {}),
      ...(userId ? { id_usuario: userId } : {}),
      ...(action ? { accion: action } : {}),
      ...(entity ? { entidad_afectada: entity } : {}),
      ...(searchText
        ? {
            OR: [
              { detalle: { contains: searchText, mode: "insensitive" } },
              { entidad_afectada: { contains: searchText, mode: "insensitive" } },
              { accion: { contains: searchText, mode: "insensitive" } },
              { id_registro_afectado: { contains: searchText, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ fecha_hora: "desc" }, { id_bitacora: "desc" }],
    take: limit,
    include: {
      usuario: true,
    },
  });

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
      return buildSalesCollectionsCsv(searchParams, limit);

    case "suppliers-purchases":
      return exportSuppliersPurchasesReport(searchParams, limit);

    case "financial":
      return buildFinancialCsv(searchParams, limit);

    case "maintenance":
      return buildMaintenanceCsv(searchParams, limit);

    case "profitability":
      return buildProfitabilityCsv(searchParams, limit);

    case "staff":
      return buildStaffCsv(searchParams, limit);

    case "audit":
      return buildAuditCsv(searchParams, limit);

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
