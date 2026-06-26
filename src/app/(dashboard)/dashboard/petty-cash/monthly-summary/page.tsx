import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireRole } from "@/lib/authz";
import { APP_ROLES } from "@/lib/permissions";
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
    return "destructive";
  }

  if (type === "ajuste") {
    return "secondary";
  }

  return "default";
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
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">
            Dashboard · Caja chica y finanzas · Resumen mensual
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Resumen mensual financiero
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Consulta ventas cobradas, saldos pendientes, costos de producción,
            movimientos de caja chica y utilidad estimada del mes seleccionado.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/petty-cash"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Volver al módulo
          </Link>

          <Badge variant="secondary">Fase 7.7</Badge>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Periodo de análisis</CardTitle>
        </CardHeader>

        <CardContent>
          <form method="GET" className="flex flex-col gap-3 md:flex-row">
            <div className="space-y-2">
              <label htmlFor="month" className="text-sm font-medium">
                Mes
              </label>

              <input
                id="month"
                name="month"
                type="month"
                defaultValue={selectedMonth}
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 md:w-64"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Consultar
              </button>

              <Link
                href={`/dashboard/petty-cash/monthly-summary?month=${getMonthValue(
                  previousMonthDate,
                )}`}
                className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Mes anterior
              </Link>

              <Link
                href={`/dashboard/petty-cash/monthly-summary?month=${getMonthValue(
                  nextMonthDate,
                )}`}
                className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
              >
                Mes siguiente
              </Link>
            </div>
          </form>

          <p className="mt-4 text-sm text-muted-foreground">
            Periodo seleccionado:{" "}
            <span className="font-medium text-slate-700">
              {formatMonthLabel(startOfMonth)}
            </span>
          </p>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas cobradas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalCollectedSales)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {collectedPayments._count.id_pago_cliente} pagos de cliente en el
              mes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldos pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalPendingBalances)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {pendingBalances._count.id_proforma} proformas con saldo pendiente.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Costos de producción</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(totalProductionCost)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {productionCosts._count.id_costeo} costeos registrados en el mes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Utilidad estimada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(estimatedProfit)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Margen promedio: {formatPercent(profitability._avg.margen_real)}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingresos caja chica</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(cashIncome)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresos menores del mes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Egresos caja chica</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(cashExpenses)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Gastos menores del mes.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ajustes netos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatMoney(positiveAdjustments - negativeAdjustments)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajustes positivos menos negativos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado caja chica</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(cashNetResult)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ingresos + ajustes - egresos.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldo abierto actual</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatMoney(openCashBalance)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Suma de cajas abiertas.
            </p>
          </CardContent>
        </Card>
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

            <div className="border-t pt-3">
              <div className="flex justify-between gap-3">
                <span className="font-medium">Resultado referencial</span>
                <span className="font-bold">
                  {formatMoney(referentialNetResult)}
                </span>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Este resultado no reemplaza el módulo contable. Resume ventas
                cobradas, caja chica y costos registrados dentro del sistema.
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
              <span className="text-muted-foreground">
                Ingreso estimado
              </span>
              <span className="font-medium">{formatMoney(estimatedIncome)}</span>
            </div>

            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Costo estimado
              </span>
              <span className="font-medium">
                {formatMoney(estimatedCostFromProfitability)}
              </span>
            </div>

            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                Utilidad estimada
              </span>
              <span className="font-medium">{formatMoney(estimatedProfit)}</span>
            </div>

            <div className="flex justify-between gap-3 border-t pt-3 text-sm">
              <span className="font-medium">Cálculos de rentabilidad</span>
              <span className="font-bold">
                {profitability._count.id_rentabilidad}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Gastos por categoría
            </CardTitle>
          </CardHeader>

          <CardContent>
            {expenseCategoryRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay egresos categorizados en este mes.
              </p>
            ) : (
              <div className="space-y-3">
                {expenseCategoryRows.map((row) => (
                  <div
                    key={row.category}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <span className="text-sm font-medium">{row.category}</span>
                    <span className="text-sm font-bold">
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

          <CardContent>
            {cashMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay movimientos de caja chica en el mes seleccionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3">Concepto</th>
                      <th className="py-2 pr-3">Caja</th>
                      <th className="py-2 text-right">Monto</th>
                    </tr>
                  </thead>

                  <tbody>
                    {cashMovements.slice(0, 8).map((movement) => (
                      <tr key={movement.id_movimiento_caja} className="border-b">
                        <td className="py-2 pr-3">
                          {formatDate(movement.fecha_movimiento)}
                        </td>

                        <td className="py-2 pr-3">
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
                        </td>

                        <td className="py-2 pr-3">{movement.concepto}</td>

                        <td className="py-2 pr-3">
                          {movement.caja_chica.nombre_caja}
                        </td>

                        <td className="py-2 text-right font-medium">
                          {formatMoney(movement.monto)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Link
              href={`/dashboard/petty-cash/movements?desde=${selectedMonth}-01&hasta=${selectedMonth}-31`}
              className="mt-4 inline-flex rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
            >
              Ver movimientos filtrados
            </Link>
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
              <p className="text-sm text-muted-foreground">
                No hay pagos de clientes registrados en este mes.
              </p>
            ) : (
              <div className="space-y-3">
                {latestPayments.map((payment) => (
                  <div
                    key={payment.id_pago_cliente}
                    className="rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {
                            payment.proforma.pedido.cliente
                              .nombre_razon_social
                          }
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {payment.tipo_pago} · {payment.metodo_pago}
                        </p>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(payment.fecha_pago)}
                        </p>
                      </div>

                      <Badge>{formatMoney(payment.monto_pagado)}</Badge>
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

        <CardContent>
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Materiales</p>
              <p className="text-lg font-bold">
                {formatMoney(productionCosts._sum.costo_materiales)}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Consumibles</p>
              <p className="text-lg font-bold">
                {formatMoney(productionCosts._sum.costo_consumibles)}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Mano de obra</p>
              <p className="text-lg font-bold">
                {formatMoney(productionCosts._sum.costo_mano_obra)}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">
                Costos indirectos
              </p>
              <p className="text-lg font-bold">
                {formatMoney(productionCosts._sum.costo_indirecto_total)}
              </p>
            </div>
          </section>

          {latestCostings.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No hay costeos registrados en el mes seleccionado.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Fecha</th>
                    <th className="py-2 pr-3">Referencia</th>
                    <th className="py-2 pr-3">Producto</th>
                    <th className="py-2 text-right">Costo total</th>
                  </tr>
                </thead>

                <tbody>
                  {latestCostings.map((costing) => (
                    <tr key={costing.id_costeo} className="border-b">
                      <td className="py-2 pr-3">
                        {formatDate(costing.fecha_costeo)}
                      </td>

                      <td className="py-2 pr-3">
                        {costing.pedido?.cliente.nombre_razon_social ??
                          costing.id_orden_trabajo ??
                          "-"}
                      </td>

                      <td className="py-2 pr-3">
                        {costing.orden_trabajo?.producto.nombre_producto ??
                          "-"}
                      </td>

                      <td className="py-2 text-right font-medium">
                        {formatMoney(costing.costo_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}