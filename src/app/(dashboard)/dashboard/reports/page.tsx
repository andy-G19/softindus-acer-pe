/**
 * Ubicación destino: src/app/(dashboard)/dashboard/reports/page.tsx
 * (reemplaza el archivo actual)
 *
 * Único cambio de fondo: la grilla final de "Reportes por módulo" pasa de
 * 10 <ModuleAccessCard> repetidas a un array `reportModules.map(...)`,
 * igual que en el resto de páginas — más fácil de mantener y de asignar
 * ícono/tono a cada una.
 */
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Calculator,
  CircleDollarSign,
  ClipboardList,
  Download,
  Factory,
  Hammer,
  Landmark,
  Package,
  Receipt,
  ScrollText,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Truck,
  UserRoundCheck,
  WalletCards,
  Wrench,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  ModuleAccessCard,
  type ModuleCardTone,
} from "@/components/ui/module-access-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/navigation/page-header";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { dashboardBreadcrumbs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";

const ACTIVE_WORK_ORDER_STATES = ["pendiente", "en_proceso", "pausada"];
const PENDING_ORDER_STATES = [
  "registrado",
  "aprobado",
  "en_produccion",
];
const OPEN_FAILURE_STATES = ["pendiente", "en_atencion"];
const ACTIVE_PROFORMA_STATES = ["vigente", "aceptada"];
const PENDING_PAYMENT_STATES = ["pendiente", "parcial"];

type ReportModule = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: ModuleCardTone;
};

const reportModules: ReportModule[] = [
  {
    title: "Reporte de producción",
    description:
      "Órdenes de trabajo filtradas por fecha, producto, estado y código de orden.",
    href: "/dashboard/reports/production",
    icon: Factory,
    tone: "chart-1",
  },
  {
    title: "Reporte de inventario",
    description:
      "Movimientos por material, tipo, responsable, fechas y orden de trabajo asociada.",
    href: "/dashboard/reports/inventory",
    icon: Package,
    tone: "chart-2",
  },
  {
    title: "Reporte de ventas y cobranzas",
    description:
      "Pedidos, proformas, adelantos, amortizaciones, cancelaciones, saldos y estados de cobranza.",
    href: "/dashboard/reports/sales-collections",
    icon: ShoppingCart,
    tone: "chart-3",
  },
  {
    title: "Reporte de proveedores y compras",
    description:
      "Proveedores, materiales comprados, montos, comprobantes, precios históricos y pagos pendientes.",
    href: "/dashboard/reports/suppliers-purchases",
    icon: Truck,
    tone: "chart-4",
  },
  {
    title: "Reporte financiero",
    description:
      "Caja chica, ingresos, egresos, costos, utilidad estimada, cuentas por cobrar y compras por pagar.",
    href: "/dashboard/reports/financial",
    icon: Landmark,
    tone: "chart-5",
  },
  {
    title: "Reporte de mantenimiento",
    description:
      "Máquinas, fallas, reparaciones, costos, repuestos, preventivos y reincidencias.",
    href: "/dashboard/reports/maintenance",
    icon: Wrench,
    tone: "chart-1",
  },
  {
    title: "Reporte de costos y rentabilidad",
    description:
      "Costeos, margenes, ingresos, utilidad estimada y alertas de baja rentabilidad.",
    href: "/dashboard/reports/profitability",
    icon: Calculator,
    tone: "chart-2",
  },
  {
    title: "Reporte de personal y planillas",
    description:
      "Asistencias, faltas, tardanzas, planillas, pagos y pendientes por operario.",
    href: "/dashboard/reports/staff",
    icon: UserRoundCheck,
    tone: "chart-3",
  },
  {
    title: "Historial de exportaciones",
    description:
      "Auditoría de reportes exportados por usuario, módulo, formato, filtros y fecha.",
    href: "/dashboard/reports/export-history",
    icon: Download,
    tone: "chart-4",
  },
  {
    title: "Bitacora de auditoria",
    description: "Operaciones criticas por usuario, accion, entidad afectada y fecha.",
    href: "/dashboard/audit",
    icon: ScrollText,
    tone: "chart-5",
  },
];

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
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

export default async function ReportsDashboardPage() {
  await requireRole([APP_ROLES.ADMIN]);

  const today = new Date();

  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const startOfNextMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    1,
  );

  const [
    activeWorkOrders,
    overdueWorkOrders,
    finishedWorkOrdersThisMonth,
    pendingOrders,
    collectedThisMonth,
    issuedReceiptsThisMonth,
    issuedReceiptsAmountThisMonth,
    receivables,
    pendingReceivablesCount,
    activeStockAlerts,
    activeMaterials,
    pettyCashBalance,
    pettyCashIncomeThisMonth,
    pettyCashExpenseThisMonth,
    estimatedProfitThisMonth,
    lowMarginAlerts,
    openMachineFailures,
    overduePreventiveMaintenance,
    maintenanceCostThisMonth,
    pendingSupplierPurchases,
    pendingSupplierPurchaseAmount,
    latestWorkOrders,
    criticalMaterials,
    latestCashMovements,
  ] = await Promise.all([
    prisma.orden_trabajo.count({
      where: {
        estado: {
          in: ACTIVE_WORK_ORDER_STATES,
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: {
          in: ACTIVE_WORK_ORDER_STATES,
        },
        fecha_entrega_estimada: {
          lt: startOfToday,
        },
      },
    }),

    prisma.orden_trabajo.count({
      where: {
        estado: "finalizada",
        fecha_entrega_real: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.pedido.count({
      where: {
        estado: {
          in: PENDING_ORDER_STATES,
        },
      },
    }),

    prisma.pago_cliente.aggregate({
      where: {
        fecha_pago: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.comprobante_venta.count({
      where: {
        estado: "emitido",
        fecha_emision: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
    }),

    prisma.comprobante_venta.aggregate({
      where: {
        estado: "emitido",
        fecha_emision: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto_total: true,
      },
    }),

    prisma.proforma.aggregate({
      where: {
        estado: {
          in: ACTIVE_PROFORMA_STATES,
        },
        saldo: {
          gt: 0,
        },
      },
      _sum: {
        saldo: true,
      },
    }),

    prisma.proforma.count({
      where: {
        estado: {
          in: ACTIVE_PROFORMA_STATES,
        },
        saldo: {
          gt: 0,
        },
      },
    }),

    prisma.alerta_stock.count({
      where: {
        estado_alerta: "activa",
      },
    }),

    prisma.material.findMany({
      where: {
        estado: true,
      },
      select: {
        id_material: true,
        nombre_material: true,
        categoria: true,
        unidad_medida: true,
        stock_actual: true,
        stock_minimo: true,
        stock_reservado: true,
      },
      orderBy: {
        nombre_material: "asc",
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

    prisma.movimiento_caja.aggregate({
      where: {
        tipo_movimiento: "ingreso",
        fecha_movimiento: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto: true,
      },
    }),

    prisma.movimiento_caja.aggregate({
      where: {
        tipo_movimiento: "egreso",
        fecha_movimiento: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        monto: true,
      },
    }),

    prisma.rentabilidad.aggregate({
      where: {
        fecha_calculo: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        utilidad_estimada: true,
      },
    }),

    prisma.rentabilidad.count({
      where: {
        alerta_bajo_margen: true,
      },
    }),

    prisma.falla_maquina.count({
      where: {
        estado_atencion: {
          in: OPEN_FAILURE_STATES,
        },
      },
    }),

    prisma.mantenimiento_preventivo.count({
      where: {
        estado: "pendiente",
        fecha_programada: {
          lt: startOfToday,
        },
      },
    }),

    prisma.reparacion.aggregate({
      where: {
        fecha_reparacion: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      _sum: {
        costo_total: true,
      },
    }),

    prisma.compra.count({
      where: {
        estado_pago: {
          in: PENDING_PAYMENT_STATES,
        },
        estado_compra: {
          not: "anulada",
        },
      },
    }),

    prisma.compra.aggregate({
      where: {
        estado_pago: {
          in: PENDING_PAYMENT_STATES,
        },
        estado_compra: {
          not: "anulada",
        },
      },
      _sum: {
        monto_total: true,
      },
    }),

    prisma.orden_trabajo.findMany({
      orderBy: {
        fecha_registro: "desc",
      },
      take: 5,
      include: {
        producto: true,
        cliente: true,
      },
    }),

    prisma.material.findMany({
      where: {
        estado: true,
      },
      select: {
        id_material: true,
        nombre_material: true,
        categoria: true,
        unidad_medida: true,
        stock_actual: true,
        stock_minimo: true,
        stock_reservado: true,
      },
      orderBy: {
        stock_actual: "asc",
      },
      take: 8,
    }),

    prisma.movimiento_caja.findMany({
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 5,
      include: {
        categoria_gasto: true,
      },
    }),
  ]);

  const criticalStockMaterials = activeMaterials.filter((material) => {
    return toNumber(material.stock_actual) <= toNumber(material.stock_minimo);
  });

  const realCriticalMaterials = criticalMaterials.filter((material) => {
    return toNumber(material.stock_actual) <= toNumber(material.stock_minimo);
  });

  const totalCollectedThisMonth = collectedThisMonth._sum.monto_pagado ?? 0;
  const totalIssuedReceiptsAmountThisMonth =
    issuedReceiptsAmountThisMonth._sum.monto_total ?? 0;
  const totalReceivables = receivables._sum.saldo ?? 0;
  const totalPettyCashBalance = pettyCashBalance._sum.saldo_actual ?? 0;
  const totalPettyCashIncome = pettyCashIncomeThisMonth._sum.monto ?? 0;
  const totalPettyCashExpense = pettyCashExpenseThisMonth._sum.monto ?? 0;
  const pettyCashNetMovement =
    toNumber(totalPettyCashIncome) - toNumber(totalPettyCashExpense);
  const totalEstimatedProfit =
    estimatedProfitThisMonth._sum.utilidad_estimada ?? 0;
  const totalMaintenanceCost = maintenanceCostThisMonth._sum.costo_total ?? 0;
  const totalPendingSupplierAmount =
    pendingSupplierPurchaseAmount._sum.monto_total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Vista gerencial consolidada de producción, ventas, inventario, cobranzas, caja chica, utilidad, proveedores y mantenimiento."
        breadcrumbs={dashboardBreadcrumbs([{ label: "Reportes" }])}
        actions={
          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <p className="font-medium">Periodo actual</p>
            <p className="text-muted-foreground">
              {formatDate(startOfMonth)} - {formatDate(today)}
            </p>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Órdenes activas"
          value={activeWorkOrders.toString()}
          description={`Retrasadas: ${overdueWorkOrders}. Finalizadas este mes: ${finishedWorkOrdersThisMonth}.`}
          href="/dashboard/production/work-orders"
          tone={overdueWorkOrders > 0 ? "warning" : "info"}
          icon={ClipboardList}
        />

        <KpiCard
          title="Pedidos pendientes"
          value={pendingOrders.toString()}
          description="Pedidos registrados, aprobados o en producción."
          href="/dashboard/commercial/orders"
          tone="info"
          icon={ShoppingCart}
        />

        <KpiCard
          title="Stock crítico"
          value={criticalStockMaterials.length.toString()}
          description={`Alertas activas de stock: ${activeStockAlerts}.`}
          href="/dashboard/inventory/materials"
          tone={criticalStockMaterials.length > 0 ? "warning" : "info"}
          icon={AlertTriangle}
        />

        <KpiCard
          title="Cuentas por cobrar"
          value={formatMoney(totalReceivables)}
          description={`Proformas con saldo pendiente: ${pendingReceivablesCount}.`}
          href="/dashboard/commercial/payments"
          tone="info"
          icon={Landmark}
        />

        <KpiCard
          title="Cobrado este mes"
          value={formatMoney(totalCollectedThisMonth)}
          description="Pagos de clientes registrados durante el mes."
          href="/dashboard/commercial/payments"
          tone="success"
          icon={TrendingUp}
        />

        <KpiCard
          title="Comprobantes emitidos"
          value={issuedReceiptsThisMonth.toString()}
          description={`Monto emitido: ${formatMoney(
            totalIssuedReceiptsAmountThisMonth,
          )}.`}
          href="/dashboard/commercial/receipts"
          tone="info"
          icon={Receipt}
        />

        <KpiCard
          title="Saldo de caja chica"
          value={formatMoney(totalPettyCashBalance)}
          description={`Movimiento neto del mes: ${formatMoney(
            pettyCashNetMovement,
          )}.`}
          href="/dashboard/petty-cash"
          tone="info"
          icon={WalletCards}
        />

        <KpiCard
          title="Utilidad estimada"
          value={formatMoney(totalEstimatedProfit)}
          description={`Alertas de bajo margen: ${lowMarginAlerts}.`}
          href="/dashboard/costs"
          tone={lowMarginAlerts > 0 ? "warning" : "success"}
          icon={CircleDollarSign}
        />

        <KpiCard
          title="Fallas abiertas"
          value={openMachineFailures.toString()}
          description={`Preventivos vencidos: ${overduePreventiveMaintenance}.`}
          href="/dashboard/maintenance"
          tone={openMachineFailures > 0 ? "warning" : "info"}
          icon={Wrench}
        />

        <KpiCard
          title="Costo mantenimiento"
          value={formatMoney(totalMaintenanceCost)}
          description="Costo total de reparaciones registradas este mes."
          href="/dashboard/maintenance/repairs"
          tone="info"
          icon={Hammer}
        />

        <KpiCard
          title="Compras por pagar"
          value={pendingSupplierPurchases.toString()}
          description={`Monto referencial pendiente: ${formatMoney(
            totalPendingSupplierAmount,
          )}.`}
          href="/dashboard/inventory/purchases"
          tone={pendingSupplierPurchases > 0 ? "warning" : "info"}
          icon={Truck}
        />

        <KpiCard
          title="Egresos caja chica"
          value={formatMoney(totalPettyCashExpense)}
          description={`Ingresos del mes: ${formatMoney(
            totalPettyCashIncome,
          )}.`}
          href="/dashboard/petty-cash/movements"
          tone="info"
          icon={TrendingDown}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Últimas Órdenes de trabajo
            </CardTitle>
          </CardHeader>

          <CardContent className="px-0">
            {latestWorkOrders.length === 0 ? (
              <EmptyState
                className="mx-6 border-0"
                label="Aún no hay Órdenes de trabajo registradas."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Entrega</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {latestWorkOrders.map((order) => (
                    <TableRow key={order.id_orden_trabajo}>
                      <TableCell className="font-medium">
                        {order.id_orden_trabajo}
                      </TableCell>
                      <TableCell>{order.producto.nombre_producto}</TableCell>
                      <TableCell>
                        {order.cliente?.nombre_razon_social ?? "-"}
                      </TableCell>
                      <TableCell>{order.estado}</TableCell>
                      <TableCell>
                        {formatDate(order.fecha_entrega_estimada)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Materiales más críticos
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {realCriticalMaterials.length === 0 ? (
              <EmptyState label="No hay materiales por debajo del stock mínimo." />
            ) : (
              realCriticalMaterials.map((material) => (
                <div
                  key={material.id_material}
                  className="rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {material.nombre_material}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {material.categoria}
                      </p>
                    </div>

                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                      {material.unidad_medida}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <p>
                      Stock actual:{" "}
                      <span className="font-medium">
                        {formatQuantity(material.stock_actual)}
                      </span>
                    </p>
                    <p>
                      Stock mínimo:{" "}
                      <span className="font-medium">
                        {formatQuantity(material.stock_minimo)}
                      </span>
                    </p>
                    <p className="col-span-2">
                      Reservado:{" "}
                      <span className="font-medium">
                        {formatQuantity(material.stock_reservado)}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Resumen financiero del mes
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border/80 bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Cobranza de clientes
                </p>
                <p className="text-xl font-bold text-foreground">
                  {formatMoney(totalCollectedThisMonth)}
                </p>
              </div>

              <div className="rounded-lg border border-border/80 bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Cuentas por cobrar
                </p>
                <p className="text-xl font-bold text-foreground">
                  {formatMoney(totalReceivables)}
                </p>
              </div>

              <div className="rounded-lg border border-border/80 bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Ingresos caja chica
                </p>
                <p className="text-xl font-bold text-foreground">
                  {formatMoney(totalPettyCashIncome)}
                </p>
              </div>

              <div className="rounded-lg border border-border/80 bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Egresos caja chica
                </p>
                <p className="text-xl font-bold text-foreground">
                  {formatMoney(totalPettyCashExpense)}
                </p>
              </div>

              <div className="rounded-lg border border-border/80 bg-secondary/40 p-3 md:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Utilidad estimada del mes
                </p>
                <p className="text-xl font-bold text-foreground">
                  {formatMoney(totalEstimatedProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Últimos movimientos de caja
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {latestCashMovements.length === 0 ? (
              <EmptyState label="Aún no hay movimientos de caja registrados." />
            ) : (
              latestCashMovements.map((movement) => (
                <div
                  key={movement.id_movimiento_caja}
                  className="rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{movement.concepto}</p>
                      <p className="text-xs text-muted-foreground">
                        {movement.categoria_gasto?.nombre_categoria ??
                          "Sin categoría"}{" "}
                        | {formatDate(movement.fecha_movimiento)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatMoney(movement.monto)}</p>
                      <p className="text-xs text-muted-foreground">
                        {movement.tipo_movimiento}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Reportes por módulo</h2>
          <p className="text-sm text-muted-foreground">
            Consulta reportes administrativos filtrables según cada área del sistema.
          </p>
          <p className="text-xs text-muted-foreground">
            Las exportaciones tienen un límite de seguridad por formato: el
            PDF muestra hasta 80 registros por página (con aviso si el
            reporte fue más grande) y el Excel exporta hasta 5000 filas.
            Use los filtros de cada reporte para acotar el resultado.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportModules.map((report, i) => (
            <ModuleAccessCard
              key={report.href}
              index={i + 1}
              tone={report.tone}
              icon={report.icon}
              title={report.title}
              description={report.description}
              href={report.href}
            />
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Este dashboard usa información consolidada de los módulos ya
          implementados. La precisión de los indicadores dependerá de que los
          usuarios registren oportunamente producción, pagos, movimientos de
          inventario, caja chica, costos y mantenimiento.
        </p>
      </section>
    </div>
  );
}
