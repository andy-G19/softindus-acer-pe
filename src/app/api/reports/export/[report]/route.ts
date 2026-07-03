import { auth } from "@/auth";
import { registerAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { buildExcelBuffer, excelResponse } from "@/lib/excel-export";
import { APP_ROLES } from "@/lib/permissions";
import { buildPdfBuffer, pdfResponse } from "@/lib/pdf-export";
import { buildNextId } from "@/lib/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    report: string;
  }>;
};

type CsvValue = string | number | boolean | Date | null | undefined;

type ExportReport = {
  filename: string;
  pdfFilename: string;
  title: string;
  headers: string[];
  rows: CsvValue[][];
};

const REPORT_MODULE_LABELS: Record<string, string> = {
  production: "Reporte de producción",
  inventory: "Reporte de inventario",
  "sales-collections": "Reporte de ventas y cobranzas",
  "suppliers-purchases": "Reporte de proveedores y compras",
  financial: "Reporte financiero",
  maintenance: "Reporte de mantenimiento",
  profitability: "Reporte de costos y rentabilidad",
  staff: "Reporte de personal y planillas",
  audit: "Reporte de auditoria",
};

const REPORT_ALLOWED_ROLES: Record<string, string[]> = {
  production: [APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER],
  inventory: [APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER],
  "sales-collections": [APP_ROLES.ADMIN, APP_ROLES.SELLER],
  "suppliers-purchases": [APP_ROLES.ADMIN],
  financial: [APP_ROLES.ADMIN],
  maintenance: [APP_ROLES.ADMIN, APP_ROLES.WORKSHOP_MASTER],
  profitability: [APP_ROLES.ADMIN],
  staff: [APP_ROLES.ADMIN],
  audit: [APP_ROLES.ADMIN],
};

function getParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() ?? "";
}

function parseDateInput(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function parseDateInputAsNextDay(value: string) {
  if (!value) {
    return undefined;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day + 1);
}

function buildDateRange(dateFrom: string, dateTo: string) {
  const fromDate = parseDateInput(dateFrom);
  const toDate = parseDateInputAsNextDay(dateTo);

  if (!fromDate && !toDate) {
    return undefined;
  }

  return {
    ...(fromDate ? { gte: fromDate } : {}),
    ...(toDate ? { lt: toDate } : {}),
  };
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function formatQuantity(value: unknown) {
  return toNumber(value).toFixed(2);
}

function formatDate(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function getDateStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function registerExportLog(data: {
  userId: string;
  report: string;
  filename: string;
  fileFormat: "excel" | "pdf";
  searchParams: URLSearchParams;
}) {
  const lastExport = await prisma.exportacion_datos.findFirst({
    orderBy: {
      id_exportacion: "desc",
    },
    select: {
      id_exportacion: true,
    },
  });

  const id_exportacion = buildNextId("EXP", lastExport?.id_exportacion);

  const paramsObject = Object.fromEntries(data.searchParams.entries());

  delete paramsObject.fileFormat;

  await prisma.exportacion_datos.create({
    data: {
      id_exportacion,
      id_usuario: data.userId,
      modulo_origen: REPORT_MODULE_LABELS[data.report] ?? data.report,
      formato: data.fileFormat,
      parametros: JSON.stringify(paramsObject),
      estado: "generada",
      ruta_archivo: data.filename,
    },
  });

  await registerAuditLog({
    userId: data.userId,
    entidad_afectada: "exportacion_datos",
    id_registro_afectado: id_exportacion,
    accion: "crear",
    detalle: `Reporte exportado: ${
      REPORT_MODULE_LABELS[data.report] ?? data.report
    } (${data.fileFormat}).`,
  });
}

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

async function buildProductionCsv(searchParams: URLSearchParams): Promise<ExportReport> {
  const dateFrom = getParam(searchParams, "dateFrom");
  const dateTo = getParam(searchParams, "dateTo");
  const productId = getParam(searchParams, "productId");
  const status = getParam(searchParams, "status");
  const orderId = getParam(searchParams, "orderId").toUpperCase();

  const dateRange = buildDateRange(dateFrom, dateTo);

  const orders = await prisma.orden_trabajo.findMany({
    where: {
      ...(dateRange ? { fecha_inicio: dateRange } : {}),
      ...(productId ? { id_producto: productId } : {}),
      ...(status ? { estado: status } : {}),
      ...(orderId
        ? {
            id_orden_trabajo: {
              contains: orderId,
            },
          }
        : {}),
    },
    orderBy: [
      { fecha_inicio: "desc" },
      { fecha_registro: "desc" },
    ],
    include: {
      producto: true,
      cliente: true,
      ruta_fabricacion: true,
      usuario: true,
      avance_orden: {
        select: {
          porcentaje_avance: true,
        },
      },
    },
  });

  return {
    filename: `reporte_produccion_${getDateStamp()}.xlsx`,
    pdfFilename: `reporte_produccion_${getDateStamp()}.pdf`,
    title: "Reporte de Producción",
    headers: [
      "Orden",
      "Producto",
      "Cliente",
      "Tipo producción",
      "Cantidad",
      "Fecha inicio",
      "Fecha entrega estimada",
      "Fecha entrega real",
      "Estado",
      "Prioridad",
      "Ruta",
      "Responsable",
      "Avance promedio",
      "Observaciones",
    ],
    rows: orders.map((order) => {
      const averageProgress =
        order.avance_orden.length === 0
          ? 0
          : order.avance_orden.reduce((sum, progress) => {
              return sum + toNumber(progress.porcentaje_avance);
            }, 0) / order.avance_orden.length;

      return [
        order.id_orden_trabajo,
        order.producto.nombre_producto,
        order.cliente?.nombre_razon_social ?? "",
        order.tipo_produccion,
        formatQuantity(order.cantidad),
        formatDate(order.fecha_inicio),
        formatDate(order.fecha_entrega_estimada),
        formatDate(order.fecha_entrega_real),
        order.estado,
        order.prioridad,
        order.ruta_fabricacion?.nombre_ruta ?? "",
        `${order.usuario.apellidos}, ${order.usuario.nombres}`,
        `${averageProgress.toFixed(2)}%`,
        order.observaciones ?? "",
      ];
    }),
  };
}

async function buildInventoryCsv(searchParams: URLSearchParams): Promise<ExportReport> {
  const dateFrom = getParam(searchParams, "dateFrom");
  const dateTo = getParam(searchParams, "dateTo");
  const materialId = getParam(searchParams, "materialId");
  const movementType = getParam(searchParams, "movementType");
  const userId = getParam(searchParams, "userId");
  const workOrderId = getParam(searchParams, "workOrderId").toUpperCase();

  const dateRange = buildDateRange(dateFrom, dateTo);

  const movements = await prisma.movimiento_inventario.findMany({
    where: {
      ...(dateRange ? { fecha_movimiento: dateRange } : {}),
      ...(materialId ? { id_material: materialId } : {}),
      ...(movementType ? { tipo_movimiento: movementType } : {}),
      ...(userId ? { id_usuario_responsable: userId } : {}),
      ...(workOrderId
        ? {
            id_orden_trabajo: {
              contains: workOrderId,
            },
          }
        : {}),
    },
    orderBy: {
      fecha_movimiento: "desc",
    },
    include: {
      material: true,
      usuario: true,
      orden_trabajo: {
        include: {
          producto: true,
        },
      },
      compra: {
        include: {
          proveedor: true,
        },
      },
    },
  });

  return {
    filename: `reporte_inventario_${getDateStamp()}.xlsx`,
    pdfFilename: `reporte_inventario_${getDateStamp()}.pdf`,
    title: "Reporte de Inventario",
    headers: [
      "Movimiento",
      "Material",
      "Categoría",
      "Unidad",
      "Tipo movimiento",
      "Cantidad",
      "Stock anterior",
      "Stock resultante",
      "Fecha",
      "Responsable",
      "Orden de trabajo",
      "Producto orden",
      "Compra",
      "Proveedor",
      "Motivo",
    ],
    rows: movements.map((movement) => [
      movement.id_movimiento,
      movement.material.nombre_material,
      movement.material.categoria,
      movement.material.unidad_medida,
      movement.tipo_movimiento,
      formatQuantity(movement.cantidad),
      formatQuantity(movement.stock_anterior),
      formatQuantity(movement.stock_resultante),
      formatDateTime(movement.fecha_movimiento),
      `${movement.usuario.apellidos}, ${movement.usuario.nombres}`,
      movement.orden_trabajo?.id_orden_trabajo ?? "",
      movement.orden_trabajo?.producto.nombre_producto ?? "",
      movement.compra?.id_compra ?? "",
      movement.compra?.proveedor.razon_social ?? "",
      movement.motivo ?? "",
    ]),
  };
}

async function buildSalesCollectionsCsv(
  searchParams: URLSearchParams,
): Promise<ExportReport> {
  const dateFrom = getParam(searchParams, "dateFrom");
  const dateTo = getParam(searchParams, "dateTo");
  const clientId = getParam(searchParams, "clientId");
  const orderStatus = getParam(searchParams, "orderStatus");
  const collectionStatus = getParam(searchParams, "collectionStatus");
  const searchCode = getParam(searchParams, "searchCode").toUpperCase();

  const dateRange = buildDateRange(dateFrom, dateTo);

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
    orderBy: {
      fecha_pedido: "desc",
    },
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
    filename: `reporte_ventas_cobranzas_${getDateStamp()}.xlsx`,
    pdfFilename: `reporte_ventas_cobranzas_${getDateStamp()}.pdf`,
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
      formatDate(row.order.fecha_pedido),
      row.order.estado,
      formatMoney(row.order.monto_estimado),
      row.quote?.numero_proforma ?? "",
      formatDate(row.quote?.fecha_emision),
      row.quote?.estado ?? "",
      formatMoney(row.quote?.monto_total),
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

async function buildSuppliersPurchasesCsv(
  searchParams: URLSearchParams,
): Promise<ExportReport> {
  const dateFrom = getParam(searchParams, "dateFrom");
  const dateTo = getParam(searchParams, "dateTo");
  const supplierId = getParam(searchParams, "supplierId");
  const materialId = getParam(searchParams, "materialId");
  const purchaseStatus = getParam(searchParams, "purchaseStatus");
  const paymentStatus = getParam(searchParams, "paymentStatus");
  const searchCode = getParam(searchParams, "searchCode").toUpperCase();

  const dateRange = buildDateRange(dateFrom, dateTo);

  const purchases = await prisma.compra.findMany({
    where: {
      ...(dateRange ? { fecha_compra: dateRange } : {}),
      ...(supplierId ? { id_proveedor: supplierId } : {}),
      ...(purchaseStatus ? { estado_compra: purchaseStatus } : {}),
      ...(paymentStatus ? { estado_pago: paymentStatus } : {}),
      ...(materialId
        ? {
            detalle_compra: {
              some: {
                id_material: materialId,
              },
            },
          }
        : {}),
      ...(searchCode
        ? {
            OR: [
              {
                id_compra: {
                  contains: searchCode,
                },
              },
              {
                numero_comprobante: {
                  contains: searchCode,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: {
      fecha_compra: "desc",
    },
    include: {
      proveedor: true,
      usuario: true,
      detalle_compra: {
        include: {
          material: true,
        },
      },
      pago_proveedor: true,
      historial_precio_proveedor: {
        include: {
          material: true,
        },
        orderBy: {
          fecha_registro: "desc",
        },
      },
    },
  });

  return {
    filename: `reporte_proveedores_compras_${getDateStamp()}.xlsx`,
    pdfFilename: `reporte_proveedores_compras_${getDateStamp()}.pdf`,
    title: "Reporte de Proveedores y Compras",
    headers: [
      "Compra",
      "Proveedor",
      "Fecha compra",
      "Tipo comprobante",
      "Número comprobante",
      "Subtotal",
      "IGV",
      "Monto total",
      "Monto pagado",
      "Saldo pendiente",
      "Estado compra",
      "Estado pago",
      "Materiales comprados",
      "Precios históricos",
      "Usuario registro",
      "Observaciones",
    ],
    rows: purchases.map((purchase) => {
      const paidAmount = purchase.pago_proveedor.reduce((sum, payment) => {
        return sum + toNumber(payment.monto_pagado);
      }, 0);

      const pendingBalance = Math.max(
        toNumber(purchase.monto_total) - paidAmount,
        0,
      );

      const materialsText = purchase.detalle_compra
        .map((detail) => {
          return `${detail.material.nombre_material}: ${formatQuantity(
            detail.cantidad,
          )} ${detail.unidad_medida} x ${formatMoney(
            detail.costo_unitario,
          )} = ${formatMoney(detail.subtotal)}`;
        })
        .join(" | ");

      const historyText = purchase.historial_precio_proveedor
        .map((history) => {
          return `${history.material.nombre_material}: ${formatMoney(
            history.precio_unitario,
          )} (${formatDate(history.fecha_registro)})`;
        })
        .join(" | ");

      return [
        purchase.id_compra,
        purchase.proveedor.razon_social,
        formatDate(purchase.fecha_compra),
        purchase.tipo_comprobante ?? "",
        purchase.numero_comprobante ?? "",
        formatMoney(purchase.subtotal),
        formatMoney(purchase.igv),
        formatMoney(purchase.monto_total),
        formatMoney(paidAmount),
        formatMoney(pendingBalance),
        purchase.estado_compra,
        purchase.estado_pago,
        materialsText,
        historyText,
        `${purchase.usuario.apellidos}, ${purchase.usuario.nombres}`,
        purchase.observaciones ?? "",
      ];
    }),
  };
}

async function buildFinancialCsv(searchParams: URLSearchParams): Promise<ExportReport> {
  const dateFrom = getParam(searchParams, "dateFrom");
  const dateTo = getParam(searchParams, "dateTo");
  const cashBoxId = getParam(searchParams, "cashBoxId");
  const movementType = getParam(searchParams, "movementType");
  const categoryId = getParam(searchParams, "categoryId");
  const searchText = getParam(searchParams, "searchText");

  const dateRange = buildDateRange(dateFrom, dateTo);

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
      orderBy: {
        fecha_movimiento: "desc",
      },
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

  const summaryRows: CsvValue[][] = [
    ["Resumen", "Saldo caja chica abierta", "", formatMoney(cashBalance._sum.saldo_actual), "", "", "", ""],
    ["Resumen", "Ingresos caja chica", "", formatMoney(totalCashIncome), "", "", "", ""],
    ["Resumen", "Egresos caja chica", "", formatMoney(totalCashExpense), "", "", "", ""],
    ["Resumen", "Movimiento neto caja", "", formatMoney(totalCashIncome - totalCashExpense), "", "", "", ""],
    ["Resumen", "Cobrado a clientes", "", formatMoney(collectedPayments._sum.monto_pagado), "", "", "", ""],
    ["Resumen", "Costo producción", "", formatMoney(productionCosts._sum.costo_total), "", "", "", ""],
    ["Resumen", "Ingreso estimado", "", formatMoney(estimatedProfit._sum.ingreso_estimado), "", "", "", ""],
    ["Resumen", "Costo estimado", "", formatMoney(estimatedProfit._sum.costo_total), "", "", "", ""],
    ["Resumen", "Utilidad estimada", "", formatMoney(estimatedProfit._sum.utilidad_estimada), "", "", "", ""],
    ["Resumen", "Cuentas por cobrar", "", formatMoney(receivables._sum.saldo), "", "", "", ""],
    ["Resumen", "Compras por pagar", "", formatMoney(totalPendingPurchases), "", "", "", ""],
  ];

  const movementRows: CsvValue[][] = cashMovements.map((movement) => [
    "Movimiento caja",
    movement.id_movimiento_caja,
    movement.concepto,
    formatMoney(movement.monto),
    formatDate(movement.fecha_movimiento),
    movement.tipo_movimiento,
    movement.categoria_gasto?.nombre_categoria ?? "",
    movement.responsable ?? `${movement.usuario.apellidos}, ${movement.usuario.nombres}`,
  ]);

  return {
    filename: `reporte_financiero_${getDateStamp()}.xlsx`,
    pdfFilename: `reporte_financiero_${getDateStamp()}.pdf`,
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

async function buildMaintenanceCsv(searchParams: URLSearchParams): Promise<ExportReport> {
  const dateFrom = getParam(searchParams, "dateFrom");
  const dateTo = getParam(searchParams, "dateTo");
  const machineId = getParam(searchParams, "machineId");
  const failureStatus = getParam(searchParams, "failureStatus");
  const repairStatus = getParam(searchParams, "repairStatus");
  const preventiveStatus = getParam(searchParams, "preventiveStatus");
  const searchText = getParam(searchParams, "searchText");

  const dateRange = buildDateRange(dateFrom, dateTo);

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
      orderBy: {
        fecha_falla: "desc",
      },
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
      orderBy: {
        fecha_programada: "asc",
      },
      include: {
        maquina: true,
        usuario: true,
      },
    }),
  ]);

  const failureRows: CsvValue[][] = failures.map((failure) => {
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

  const preventiveRows: CsvValue[][] = preventives.map((maintenance) => [
    "Preventivo",
    maintenance.id_mantenimiento,
    maintenance.maquina.nombre,
    maintenance.maquina.tipo,
    formatDate(maintenance.fecha_programada),
    maintenance.estado,
    maintenance.actividad,
    "",
    "",
    "",
    maintenance.responsable ?? `${maintenance.usuario.apellidos}, ${maintenance.usuario.nombres}`,
  ]);

  return {
    filename: `reporte_mantenimiento_${getDateStamp()}.xlsx`,
    pdfFilename: `reporte_mantenimiento_${getDateStamp()}.pdf`,
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
): Promise<ExportReport> {
  const dateFrom = getParam(searchParams, "dateFrom") || getParam(searchParams, "from");
  const dateTo = getParam(searchParams, "dateTo") || getParam(searchParams, "to");
  const searchText = getParam(searchParams, "q") || getParam(searchParams, "searchText");
  const lowMargin = getParam(searchParams, "lowMargin");
  const negativeProfit = getParam(searchParams, "negativeProfit");
  const dateRange = buildDateRange(dateFrom, dateTo);

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
    orderBy: {
      fecha_costeo: "desc",
    },
    take: 300,
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
    filename: `costos_rentabilidad_${getDateStamp()}.xlsx`,
    pdfFilename: `costos_rentabilidad_${getDateStamp()}.pdf`,
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
        formatDate(costing.fecha_costeo),
        formatMoney(costing.costo_materiales),
        formatMoney(costing.costo_consumibles),
        formatMoney(costing.costo_mano_obra),
        formatMoney(costing.costo_indirecto_total),
        formatMoney(costing.costo_total),
        formatMoney(margin?.precio_sugerido),
        formatMoney(margin?.precio_final),
        formatMoney(profitability?.ingreso_estimado),
        formatMoney(profitability?.utilidad_estimada),
        `${formatQuantity(profitability?.margen_real)}%`,
        profitability?.alerta_bajo_margen ? "Margen bajo" : "Sin alerta",
      ];
    }),
  };
}

async function buildStaffCsv(searchParams: URLSearchParams): Promise<ExportReport> {
  const dateFrom = getParam(searchParams, "dateFrom") || getParam(searchParams, "from");
  const dateTo = getParam(searchParams, "dateTo") || getParam(searchParams, "to");
  const operatorId = getParam(searchParams, "operatorId") || getParam(searchParams, "operario");
  const payrollStatus = getParam(searchParams, "payrollStatus") || getParam(searchParams, "estado");
  const paymentMode = getParam(searchParams, "paymentMode") || getParam(searchParams, "modalidad");
  const searchText = getParam(searchParams, "q") || getParam(searchParams, "searchText");
  const dateRange = buildDateRange(dateFrom, dateTo);

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
    orderBy: {
      fecha_generacion: "desc",
    },
    take: 300,
    include: {
      operario: true,
      historial_pago_operario: true,
    },
  });

  return {
    filename: `personal_planillas_${getDateStamp()}.xlsx`,
    pdfFilename: `personal_planillas_${getDateStamp()}.pdf`,
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
        formatDate(payroll.periodo_inicio),
        formatDate(payroll.periodo_fin),
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

async function buildAuditCsv(searchParams: URLSearchParams): Promise<ExportReport> {
  const dateFrom = getParam(searchParams, "dateFrom") || getParam(searchParams, "from");
  const dateTo = getParam(searchParams, "dateTo") || getParam(searchParams, "to");
  const userId = getParam(searchParams, "userId") || getParam(searchParams, "usuario");
  const action = getParam(searchParams, "action") || getParam(searchParams, "accion");
  const entity = getParam(searchParams, "entity") || getParam(searchParams, "entidad");
  const searchText = getParam(searchParams, "q") || getParam(searchParams, "searchText");
  const dateRange = buildDateRange(dateFrom, dateTo);

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
    orderBy: {
      fecha_hora: "desc",
    },
    take: 500,
    include: {
      usuario: true,
    },
  });

  return {
    filename: `auditoria_${getDateStamp()}.xlsx`,
    pdfFilename: `auditoria_${getDateStamp()}.pdf`,
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

async function buildReport(report: string, searchParams: URLSearchParams): Promise<ExportReport | null> {
  switch (report) {
    case "production":
      return buildProductionCsv(searchParams);

    case "inventory":
      return buildInventoryCsv(searchParams);

    case "sales-collections":
      return buildSalesCollectionsCsv(searchParams);

    case "suppliers-purchases":
      return buildSuppliersPurchasesCsv(searchParams);

    case "financial":
      return buildFinancialCsv(searchParams);

    case "maintenance":
      return buildMaintenanceCsv(searchParams);

    case "profitability":
      return buildProfitabilityCsv(searchParams);

    case "staff":
      return buildStaffCsv(searchParams);

    case "audit":
      return buildAuditCsv(searchParams);

    default:
      return null;
  }
}

export async function GET(request: Request, context: RouteContext) {
  const session = await auth();

  if (!session?.user) {
    return new Response("No autorizado.", {
      status: 401,
    });
  }

  const { report } = await context.params;
  const url = new URL(request.url);

  const allowedRoles = REPORT_ALLOWED_ROLES[report] ?? [];

  if (!allowedRoles.includes(session.user.role)) {
    return new Response("Acceso denegado.", {
      status: 403,
    });
  }

  const exportReport = await buildReport(report, url.searchParams);

  if (!exportReport) {
    return new Response("Reporte no encontrado.", {
      status: 404,
    });
  }

  const fileFormat =
    url.searchParams.get("fileFormat") === "pdf" ? "pdf" : "excel";

  if (fileFormat === "pdf") {
    await registerExportLog({
      userId: session.user.id,
      report,
      filename: exportReport.pdfFilename,
      fileFormat: "pdf",
      searchParams: url.searchParams,
    });

    const pdfBuffer = await buildPdfBuffer({
      title: exportReport.title,
      subtitle: "Sistema de Gestion Integral - Industrias Aceros Peru",
      headers: exportReport.headers,
      rows: exportReport.rows.slice(0, 80),
    });

    return pdfResponse(pdfBuffer, exportReport.pdfFilename);
  }

  await registerExportLog({
    userId: session.user.id,
    report,
    filename: exportReport.filename,
    fileFormat: "excel",
    searchParams: url.searchParams,
  });

  const excelBuffer = await buildExcelBuffer({
    title: exportReport.title,
    headers: exportReport.headers,
    rows: exportReport.rows,
  });

  return excelResponse(excelBuffer, exportReport.filename);
}
