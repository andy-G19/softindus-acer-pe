import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { Label } from "@/components/ui/label";
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
import { APP_ROLES } from "@/lib/permissions";
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { prisma } from "@/lib/db";

type MonthlySummaryPageProps = {
  searchParams?: Promise<{
    month?: string;
  }>;
};

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
}

function formatPercent(value: unknown) {
  return `${toNumber(value).toFixed(2)}%`;
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

function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function getMonthValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthRange(monthParam: string | undefined) {
  const today = new Date();
  const currentMonth = getMonthValue(today);
  const selectedMonth = monthParam?.trim() || currentMonth;
  const [yearText, monthText] = selectedMonth.split("-");

  const year = Number(yearText);
  const month = Number(monthText);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    month < 1 ||
    month > 12
  ) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    return {
      selectedMonth: currentMonth,
      startOfMonth: start,
      startOfNextMonth: next,
    };
  }

  const startOfMonth = new Date(year, month - 1, 1);
  const startOfNextMonth = new Date(year, month, 1);

  return {
    selectedMonth,
    startOfMonth,
    startOfNextMonth,
  };
}

function getMovementLabel(type: string, concept: string) {
  if (type === "ingreso") {
    return "Ingreso";
  }

  if (type === "egreso") {
    return "Egreso";
  }

  if (concept.startsWith("Ajuste positivo")) {
    return "Ajuste positivo";
  }

  if (concept.startsWith("Ajuste negativo")) {
    return "Ajuste negativo";
  }

  return "Ajuste";
}

function getMovementBadgeVariant(type: string, concept: string) {
  if (type === "egreso" || concept.startsWith("Ajuste negativo")) {
    return "destructive" as const;
  }

  if (type === "ajuste") {
    return "secondary" as const;
  }

  return "success" as const;
}

export default async function MonthlyFinancialSummaryPage({
  searchParams,
}: MonthlySummaryPageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = (await searchParams) ?? {};
  const { selectedMonth, startOfMonth, startOfNextMonth } = getMonthRange(
    params.month,
  );

  const previousMonthDate = new Date(
    startOfMonth.getFullYear(),
    startOfMonth.getMonth() - 1,
    1,
  );

  const nextMonthDate = new Date(
    startOfMonth.getFullYear(),
    startOfMonth.getMonth() + 1,
    1,
  );

  const monthDateFilter = {
    gte: startOfMonth,
    lt: startOfNextMonth,
  };

  const [
    cashMovements,
    collectedPayments,
    pendingBalances,
    productionCosts,
    profitability,
    openCashBoxes,
    latestCostings,
    latestPayments,
  ] = await Promise.all([
    prisma.movimiento_caja.findMany({
      where: {
        fecha_movimiento: monthDateFilter,
      },
      orderBy: [
        {
          fecha_movimiento: "desc",
        },
        {
          id_movimiento_caja: "desc",
        },
      ],
      include: {
        caja_chica: true,
        categoria_gasto: true,
        usuario: true,
      },
    }),

    prisma.pago_cliente.aggregate({
      where: {
        fecha_pago: monthDateFilter,
      },
      _count: {
        id_pago_cliente: true,
      },
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.proforma.aggregate({
      where: {
        saldo: {
          gt: 0,
        },
        estado: {
          not: "anulada",
        },
      },
      _count: {
        id_proforma: true,
      },
      _sum: {
        saldo: true,
      },
    }),

    prisma.costeo.aggregate({
      where: {
        fecha_costeo: monthDateFilter,
      },
      _count: {
        id_costeo: true,
      },
      _sum: {
        costo_materiales: true,
        costo_consumibles: true,
        costo_mano_obra: true,
        costo_indirecto_total: true,
        costo_total: true,
      },
    }),

    prisma.rentabilidad.aggregate({
      where: {
        fecha_calculo: monthDateFilter,
      },
      _count: {
        id_rentabilidad: true,
      },
      _sum: {
        ingreso_estimado: true,
        costo_total: true,
        utilidad_estimada: true,
      },
      _avg: {
        margen_real: true,
      },
    }),

    prisma.caja_chica.findMany({
      where: {
        estado: "abierta",
      },
      orderBy: {
        nombre_caja: "asc",
      },
    }),

    prisma.costeo.findMany({
      where: {
        fecha_costeo: monthDateFilter,
      },
      orderBy: {
        fecha_costeo: "desc",
      },
      take: 5,
      include: {
        pedido: {
          include: {
            cliente: true,
          },
        },
        orden_trabajo: {
          include: {
            producto: true,
          },
        },
      },
    }),

    prisma.pago_cliente.findMany({
      where: {
        fecha_pago: monthDateFilter,
      },
      orderBy: {
        fecha_pago: "desc",
      },
      take: 5,
      include: {
        proforma: {
          include: {
            pedido: {
              include: {
                cliente: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const cashIncome = cashMovements
    .filter((movement) => movement.tipo_movimiento === "ingreso")
    .reduce((total, movement) => {
      return total + toNumber(movement.monto);
    }, 0);

  const cashExpenses = cashMovements
    .filter((movement) => movement.tipo_movimiento === "egreso")
    .reduce((total, movement) => {
      return total + toNumber(movement.monto);
    }, 0);

  const positiveAdjustments = cashMovements
    .filter((movement) => {
      return (
        movement.tipo_movimiento === "ajuste" &&
        movement.concepto.startsWith("Ajuste positivo")
      );
    })
    .reduce((total, movement) => {
      return total + toNumber(movement.monto);
    }, 0);

  const negativeAdjustments = cashMovements
    .filter((movement) => {
      return (
        movement.tipo_movimiento === "ajuste" &&
        movement.concepto.startsWith("Ajuste negativo")
      );
    })
    .reduce((total, movement) => {
      return total + toNumber(movement.monto);
    }, 0);

  const cashNetResult =
    cashIncome + positiveAdjustments - cashExpenses - negativeAdjustments;

  const totalCollectedSales = toNumber(collectedPayments._sum.monto_pagado);
  const totalPendingBalances = toNumber(pendingBalances._sum.saldo);
  const totalProductionCost = toNumber(productionCosts._sum.costo_total);
  const estimatedProfit = toNumber(profitability._sum.utilidad_estimada);
  const estimatedIncome = toNumber(profitability._sum.ingreso_estimado);
  const estimatedCostFromProfitability = toNumber(profitability._sum.costo_total);

  const referentialNetResult =
    totalCollectedSales + cashNetResult - totalProductionCost;

  const openCashBalance = openCashBoxes.reduce((total, box) => {
    return total + toNumber(box.saldo_actual);
  }, 0);

  const expenseByCategory = cashMovements
    .filter((movement) => movement.tipo_movimiento === "egreso")
    .reduce(
      (acc, movement) => {
        const categoryName =
          movement.categoria_gasto?.nombre_categoria ?? "Sin categoría";

        acc[categoryName] = (acc[categoryName] ?? 0) + toNumber(movement.monto);

        return acc;
      },
      {} as Record<string, number>,
    );

  const expenseCategoryRows = Object.entries(expenseByCategory)
    .map(([category, amount]) => ({
      category,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <main className="space-y-6">
      <PageHeader
        title="Resumen mensual financiero"
        description="Consulta ventas cobradas, saldos pendientes, costos de producción, movimientos de caja chica y utilidad estimada del mes seleccionado."
        backHref={navigationHrefs.pettyCash}
        backLabel="Volver al módulo"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Caja chica", href: navigationHrefs.pettyCash },
          { label: "Resumen mensual" },
        ])}
        actions={<Badge>Solo ADMIN</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Periodo de análisis</CardTitle>
        </CardHeader>

        <CardContent>
          <form method="GET" className="flex flex-col gap-3 md:flex-row">
            <div className="space-y-2">
              <Label htmlFor="month">Mes</Label>
              <Input
                id="month"
                name="month"
                type="month"
                defaultValue={selectedMonth}
                className="md:w-64"
              />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit">Consultar</Button>

              <Button variant="outline" asChild>
                <Link
                  href={`/dashboard/petty-cash/monthly-summary?month=${getMonthValue(
                    previousMonthDate,
                  )}`}
                >
                  Mes anterior
                </Link>
              </Button>

              <Button variant="outline" asChild>
                <Link
                  href={`/dashboard/petty-cash/monthly-summary?month=${getMonthValue(
                    nextMonthDate,
                  )}`}
                >
                  Mes siguiente
                </Link>
              </Button>
            </div>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            Periodo seleccionado:{" "}
            <span className="font-medium text-foreground">
              {formatMonthLabel(startOfMonth)}
            </span>
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Ventas cobradas" value={formatMoney(totalCollectedSales)} description={`${collectedPayments._count.id_pago_cliente} pagos de cliente en el mes.`} tone="success" />
        <KpiCard title="Saldos pendientes" value={formatMoney(totalPendingBalances)} description={`${pendingBalances._count.id_proforma} proformas con saldo pendiente.`} tone="warning" />
        <KpiCard title="Costos de producción" value={formatMoney(totalProductionCost)} description={`${productionCosts._count.id_costeo} costeos registrados en el mes.`} tone="warning" />
        <KpiCard title="Utilidad estimada" value={formatMoney(estimatedProfit)} description={`Margen promedio: ${formatPercent(profitability._avg.margen_real)}`} tone="info" />
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <KpiCard title="Ingresos caja chica" value={formatMoney(cashIncome)} description="Ingresos menores del mes." tone="success" />
        <KpiCard title="Egresos caja chica" value={formatMoney(cashExpenses)} description="Gastos menores del mes." tone="warning" />
        <KpiCard title="Ajustes netos" value={formatMoney(positiveAdjustments - negativeAdjustments)} description="Ajustes positivos menos negativos." tone="info" />
        <KpiCard title="Resultado caja chica" value={formatMoney(cashNetResult)} description="Ingresos + ajustes - egresos." tone="info" />
        <KpiCard title="Saldo abierto actual" value={formatMoney(openCashBalance)} description="Suma de cajas abiertas." tone="info" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Resultado financiero referencial
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Ventas cobradas</span>
              <span className="font-medium">
                {formatMoney(totalCollectedSales)}
              </span>
            </div>

            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Resultado caja chica
              </span>
              <span className="font-medium">{formatMoney(cashNetResult)}</span>
            </div>

            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Costos de producción
              </span>
              <span className="font-medium">
                - {formatMoney(totalProductionCost)}
              </span>
            </div>

            <div className="border-t border-border/70 pt-3">
              <div className="flex justify-between gap-3">
                <span className="font-medium">Resultado referencial</span>
                <span className="font-bold">
                  {formatMoney(referentialNetResult)}
                </span>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Este resultado no reemplaza el módulo contable. Resume ventas
                cobradas, caja chica y costos registrados dentro del
                sistema.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rentabilidad registrada
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Ingreso estimado</span>
              <span className="font-medium">{formatMoney(estimatedIncome)}</span>
            </div>

            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Costo estimado</span>
              <span className="font-medium">
                {formatMoney(estimatedCostFromProfitability)}
              </span>
            </div>

            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Utilidad estimada</span>
              <span className="font-medium">{formatMoney(estimatedProfit)}</span>
            </div>

            <div className="flex justify-between gap-3 border-t border-border/70 pt-3 text-sm">
              <span className="font-medium">Cálculos de rentabilidad</span>
              <span className="font-bold">
                {profitability._count.id_rentabilidad}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos por categoría</CardTitle>
          </CardHeader>

          <CardContent>
            {expenseCategoryRows.length === 0 ? (
              <EmptyState label="No hay egresos categorizados en este mes." />
            ) : (
              <div className="space-y-3">
                {expenseCategoryRows.map((row) => (
                  <div
                    key={row.category}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <span className="text-sm font-medium text-foreground">
                      {row.category}
                    </span>
                    <span className="text-sm font-bold text-foreground">
                      {formatMoney(row.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Últimos movimientos de caja del mes
            </CardTitle>
          </CardHeader>

          <CardContent className="px-0">
            {cashMovements.length === 0 ? (
              <EmptyState
                className="mx-6 border-0"
                label="No hay movimientos de caja chica en el mes seleccionado."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Caja</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {cashMovements.slice(0, 8).map((movement) => (
                    <TableRow key={movement.id_movimiento_caja}>
                      <TableCell>{formatDate(movement.fecha_movimiento)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={getMovementBadgeVariant(
                            movement.tipo_movimiento,
                            movement.concepto,
                          )}
                        >
                          {getMovementLabel(
                            movement.tipo_movimiento,
                            movement.concepto,
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{movement.concepto}</TableCell>
                      <TableCell>{movement.caja_chica.nombre_caja}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMoney(movement.monto)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="px-6 pt-4">
              <Button variant="outline" asChild>
                <Link
                  href={`/dashboard/petty-cash/movements?desde=${selectedMonth}-01&hasta=${selectedMonth}-31`}
                >
                  Ver movimientos filtrados
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Últimos pagos de clientes del mes
            </CardTitle>
          </CardHeader>

          <CardContent>
            {latestPayments.length === 0 ? (
              <EmptyState label="No hay pagos de clientes registrados en este mes." />
            ) : (
              <div className="space-y-3">
                {latestPayments.map((payment) => (
                  <div
                    key={payment.id_pago_cliente}
                    className="rounded-lg border border-border/80 bg-secondary/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {payment.proforma.pedido.cliente.nombre_razon_social}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {payment.tipo_pago} · {payment.metodo_pago}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(payment.fecha_pago)}
                        </p>
                      </div>

                      <Badge variant="success">
                        {formatMoney(payment.monto_pagado)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Costos de producción del mes
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          <section className="mx-6 mb-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border/80 p-3">
              <p className="text-xs text-muted-foreground">Materiales</p>
              <p className="text-lg font-bold text-foreground">
                {formatMoney(productionCosts._sum.costo_materiales)}
              </p>
            </div>

            <div className="rounded-lg border border-border/80 p-3">
              <p className="text-xs text-muted-foreground">Consumibles</p>
              <p className="text-lg font-bold text-foreground">
                {formatMoney(productionCosts._sum.costo_consumibles)}
              </p>
            </div>

            <div className="rounded-lg border border-border/80 p-3">
              <p className="text-xs text-muted-foreground">Mano de obra</p>
              <p className="text-lg font-bold text-foreground">
                {formatMoney(productionCosts._sum.costo_mano_obra)}
              </p>
            </div>

            <div className="rounded-lg border border-border/80 p-3">
              <p className="text-xs text-muted-foreground">
                Costos indirectos
              </p>
              <p className="text-lg font-bold text-foreground">
                {formatMoney(productionCosts._sum.costo_indirecto_total)}
              </p>
            </div>
          </section>

          {latestCostings.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No hay costeos registrados en el mes seleccionado."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Costo total</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {latestCostings.map((costing) => (
                  <TableRow key={costing.id_costeo}>
                    <TableCell>{formatDate(costing.fecha_costeo)}</TableCell>
                    <TableCell>
                      {costing.pedido?.cliente.nombre_razon_social ??
                        costing.id_orden_trabajo ??
                        "-"}
                    </TableCell>
                    <TableCell>
                      {costing.orden_trabajo?.producto.nombre_producto ?? "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(costing.costo_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
