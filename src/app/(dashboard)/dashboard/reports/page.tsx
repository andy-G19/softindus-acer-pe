import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/db";
import { APP_ROLES } from "@/lib/permissions";

const ACTIVE_WORK_ORDER_STATES = ["pendiente", "en_proceso", "pausada"];
const PENDING_ORDER_STATES = [
  "registrado",
  "aprobado",
  "en_produccion",
  "en producción",
];
const OPEN_FAILURE_STATES = ["pendiente", "en_atencion"];
const ACTIVE_PROFORMA_STATES = ["vigente", "aceptada"];
const PENDING_PAYMENT_STATES = ["pendiente", "parcial"];

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

function formatDateTime(value: Date | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

type IndicatorCardProps = {
  title: string;
  value: string | number;
  description: string;
  href?: string;
};

function IndicatorCard({
  title,
  value,
  description,
  href,
}: IndicatorCardProps) {
  const content = (
    <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );

  if (!href) {
    return content;
  }

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">Fase 10 · Subfase 10.2</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Dashboard general del taller
          </h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Vista gerencial consolidada de producción, ventas, inventario,
            cobranzas, caja chica, utilidad, proveedores y mantenimiento.
          </p>
        </div>

        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <p className="font-medium">Periodo actual</p>
          <p className="text-muted-foreground">
            {formatDate(startOfMonth)} - {formatDate(today)}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <IndicatorCard
          title="Órdenes activas"
          value={activeWorkOrders}
          description={`Retrasadas: ${overdueWorkOrders}. Finalizadas este mes: ${finishedWorkOrdersThisMonth}.`}
          href="/dashboard/production/work-orders"
        />

        <IndicatorCard
          title="Pedidos pendientes"
          value={pendingOrders}
          description="Pedidos registrados, aprobados o en producción."
          href="/dashboard/commercial/orders"
        />

        <IndicatorCard
          title="Stock crítico"
          value={criticalStockMaterials.length}
          description={`Alertas activas de stock: ${activeStockAlerts}.`}
          href="/dashboard/inventory/materials"
        />

        <IndicatorCard
          title="Cuentas por cobrar"
          value={formatMoney(totalReceivables)}
          description={`Proformas con saldo pendiente: ${pendingReceivablesCount}.`}
          href="/dashboard/commercial/payments"
        />

        <IndicatorCard
          title="Cobrado este mes"
          value={formatMoney(totalCollectedThisMonth)}
          description="Pagos de clientes registrados durante el mes."
          href="/dashboard/commercial/payments"
        />

        <IndicatorCard
          title="Comprobantes emitidos"
          value={issuedReceiptsThisMonth}
          description={`Monto emitido: ${formatMoney(
            totalIssuedReceiptsAmountThisMonth,
          )}.`}
          href="/dashboard/commercial/receipts"
        />

        <IndicatorCard
          title="Saldo de caja chica"
          value={formatMoney(totalPettyCashBalance)}
          description={`Movimiento neto del mes: ${formatMoney(
            pettyCashNetMovement,
          )}.`}
          href="/dashboard/petty-cash"
        />

        <IndicatorCard
          title="Utilidad estimada"
          value={formatMoney(totalEstimatedProfit)}
          description={`Alertas de bajo margen: ${lowMarginAlerts}.`}
          href="/dashboard/costs"
        />

        <IndicatorCard
          title="Fallas abiertas"
          value={openMachineFailures}
          description={`Preventivos vencidos: ${overduePreventiveMaintenance}.`}
          href="/dashboard/maintenance"
        />

        <IndicatorCard
          title="Costo mantenimiento"
          value={formatMoney(totalMaintenanceCost)}
          description="Costo total de reparaciones registradas este mes."
          href="/dashboard/maintenance/repairs"
        />

        <IndicatorCard
          title="Compras por pagar"
          value={pendingSupplierPurchases}
          description={`Monto referencial pendiente: ${formatMoney(
            totalPendingSupplierAmount,
          )}.`}
          href="/dashboard/inventory/purchases"
        />

        <IndicatorCard
          title="Egresos caja chica"
          value={formatMoney(totalPettyCashExpense)}
          description={`Ingresos del mes: ${formatMoney(
            totalPettyCashIncome,
          )}.`}
          href="/dashboard/petty-cash/movements"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              Últimas órdenes de trabajo
            </CardTitle>
          </CardHeader>

          <CardContent>
            {latestWorkOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aún no hay órdenes de trabajo registradas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Código</th>
                      <th className="py-2 pr-3 font-medium">Producto</th>
                      <th className="py-2 pr-3 font-medium">Cliente</th>
                      <th className="py-2 pr-3 font-medium">Estado</th>
                      <th className="py-2 pr-3 font-medium">Entrega</th>
                    </tr>
                  </thead>

                  <tbody>
                    {latestWorkOrders.map((order) => (
                      <tr key={order.id_orden_trabajo} className="border-b">
                        <td className="py-2 pr-3 font-medium">
                          {order.id_orden_trabajo}
                        </td>
                        <td className="py-2 pr-3">
                          {order.producto.nombre_producto}
                        </td>
                        <td className="py-2 pr-3">
                          {order.cliente?.nombre_razon_social ?? "-"}
                        </td>
                        <td className="py-2 pr-3">{order.estado}</td>
                        <td className="py-2 pr-3">
                          {formatDate(order.fecha_entrega_estimada)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
              <p className="text-sm text-muted-foreground">
                No hay materiales por debajo del stock mínimo.
              </p>
            ) : (
              realCriticalMaterials.map((material) => (
                <div
                  key={material.id_material}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
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
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Cobranza de clientes
                </p>
                <p className="text-xl font-bold">
                  {formatMoney(totalCollectedThisMonth)}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Cuentas por cobrar
                </p>
                <p className="text-xl font-bold">
                  {formatMoney(totalReceivables)}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Ingresos caja chica
                </p>
                <p className="text-xl font-bold">
                  {formatMoney(totalPettyCashIncome)}
                </p>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">
                  Egresos caja chica
                </p>
                <p className="text-xl font-bold">
                  {formatMoney(totalPettyCashExpense)}
                </p>
              </div>

              <div className="rounded-lg border p-3 md:col-span-2">
                <p className="text-xs text-muted-foreground">
                  Utilidad estimada del mes
                </p>
                <p className="text-xl font-bold">
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
              <p className="text-sm text-muted-foreground">
                Aún no hay movimientos de caja registrados.
              </p>
            ) : (
              latestCashMovements.map((movement) => (
                <div
                  key={movement.id_movimiento_caja}
                  className="rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{movement.concepto}</p>
                      <p className="text-xs text-muted-foreground">
                        {movement.categoria_gasto?.nombre_categoria ??
                          "Sin categoría"}{" "}
                        · {formatDate(movement.fecha_movimiento)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold">{formatMoney(movement.monto)}</p>
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
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Link href="/dashboard/reports/production" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Reporte de producción
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Órdenes de trabajo filtradas por fecha, producto, estado y código
                    de orden.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/reports/inventory" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Reporte de inventario
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Movimientos por material, tipo, responsable, fechas y orden de
                    trabajo asociada.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/reports/sales-collections" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Reporte de ventas y cobranzas
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Pedidos, proformas, adelantos, amortizaciones, cancelaciones,
                    saldos y estados de cobranza.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/reports/suppliers-purchases" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Reporte de proveedores y compras
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Proveedores, materiales comprados, montos, comprobantes, precios
                    históricos y pagos pendientes.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/reports/financial" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Reporte financiero
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Caja chica, ingresos, egresos, costos, utilidad estimada, cuentas
                    por cobrar y compras por pagar.
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/reports/maintenance" className="block">
              <Card className="h-full transition hover:bg-muted/50 hover:shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">
                    Reporte de mantenimiento
                  </CardTitle>
                </CardHeader>

                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Máquinas, fallas, reparaciones, costos, repuestos, preventivos y
                    reincidencias.
                  </p>
                </CardContent>
              </Card>
            </Link>


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