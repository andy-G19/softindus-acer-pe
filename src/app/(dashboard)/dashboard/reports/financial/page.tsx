import {
  CircleDollarSign,
  Landmark,
  Scale,
  TrendingDown,
  TrendingUp,
  Truck,
} from "lucide-react";
import Link from "next/link";
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
import { NativeSelect } from "@/components/ui/native-select";
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
import { dashboardBreadcrumbs, navigationHrefs } from "@/lib/navigation";
import { APP_ROLES } from "@/lib/permissions";
import { buildReportExportHref } from "@/lib/report-export-link";

const CASH_MOVEMENT_TYPE_OPTIONS = [
  { value: "ingreso", label: "Ingreso" },
  { value: "egreso", label: "Egreso" },
];

const ACTIVE_PROFORMA_STATES = ["vigente", "aceptada"];
const PENDING_PURCHASE_PAYMENT_STATES = ["pendiente", "parcial"];

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = params[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
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

function toNumber(value: unknown) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value.toString());
}

function formatMoney(value: unknown) {
  return `S/ ${toNumber(value).toFixed(2)}`;
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

function getCashMovementTypeLabel(type: string) {
  return (
    CASH_MOVEMENT_TYPE_OPTIONS.find((option) => option.value === type)?.label ??
    type
  );
}

function getPaidSupplierAmount(
  payments: {
    monto_pagado: unknown;
  }[],
) {
  return payments.reduce((sum, payment) => {
    return sum + toNumber(payment.monto_pagado);
  }, 0);
}

export default async function FinancialReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = searchParams ? await searchParams : {};

  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const cashBoxId = getSearchParam(params, "cashBoxId");
  const movementType = getSearchParam(params, "movementType");
  const categoryId = getSearchParam(params, "categoryId");
  const searchText = getSearchParam(params, "searchText").trim();

  const csvExportHref = buildReportExportHref("financial", {
    dateFrom,
    dateTo,
    cashBoxId,
    movementType,
    categoryId,
    searchText,
  });

  const pdfExportHref = buildReportExportHref(
  "financial",
  {
    dateFrom,
    dateTo,
    cashBoxId,
    movementType,
    categoryId,
    searchText,
  },
  "pdf",
  );

  const fromDate = parseDateInput(dateFrom);
  const toDate = parseDateInputAsNextDay(dateTo);
  const normalizedSearchText = searchText;

  const dateRangeFilter =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lt: toDate } : {}),
        }
      : undefined;

  const cashMovementWhere = {
    ...(dateRangeFilter
      ? {
          fecha_movimiento: dateRangeFilter,
        }
      : {}),
    ...(cashBoxId ? { id_caja_chica: cashBoxId } : {}),
    ...(movementType ? { tipo_movimiento: movementType } : {}),
    ...(categoryId ? { id_categoria_gasto: categoryId } : {}),
    ...(normalizedSearchText
      ? {
          OR: [
            {
              concepto: {
                contains: normalizedSearchText,
                mode: "insensitive" as const,
              },
            },
            {
              responsable: {
                contains: normalizedSearchText,
                mode: "insensitive" as const,
              },
            },
            {
              comprobante: {
                contains: normalizedSearchText,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [
    cashBoxes,
    categories,
    cashMovements,
    openCashBoxesBalance,
    collectedPayments,
    productionCosts,
    estimatedProfit,
    lowMarginAlerts,
    receivables,
    pendingSupplierPurchases,
  ] = await Promise.all([
    prisma.caja_chica.findMany({
      orderBy: {
        nombre_caja: "asc",
      },
    }),

    prisma.categoria_gasto.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_categoria: "asc",
      },
    }),

    prisma.movimiento_caja.findMany({
      where: cashMovementWhere,
      orderBy: {
        fecha_movimiento: "desc",
      },
      take: 100,
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
        ...(dateRangeFilter
          ? {
              fecha_pago: dateRangeFilter,
            }
          : {}),
      },
      _sum: {
        monto_pagado: true,
      },
    }),

    prisma.costeo.aggregate({
      where: {
        ...(dateRangeFilter
          ? {
              fecha_costeo: dateRangeFilter,
            }
          : {}),
      },
      _sum: {
        costo_total: true,
        costo_materiales: true,
        costo_consumibles: true,
        costo_mano_obra: true,
        costo_indirecto_total: true,
      },
    }),

    prisma.rentabilidad.aggregate({
      where: {
        ...(dateRangeFilter
          ? {
              fecha_calculo: dateRangeFilter,
            }
          : {}),
      },
      _sum: {
        ingreso_estimado: true,
        costo_total: true,
        utilidad_estimada: true,
      },
    }),

    prisma.rentabilidad.count({
      where: {
        alerta_bajo_margen: true,
        ...(dateRangeFilter
          ? {
              fecha_calculo: dateRangeFilter,
            }
          : {}),
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
        ...(dateRangeFilter
          ? {
              fecha_emision: dateRangeFilter,
            }
          : {}),
      },
      _sum: {
        saldo: true,
      },
    }),

    prisma.compra.findMany({
      where: {
        estado_pago: {
          in: PENDING_PURCHASE_PAYMENT_STATES,
        },
        estado_compra: {
          not: "anulada",
        },
        ...(dateRangeFilter
          ? {
              fecha_compra: dateRangeFilter,
            }
          : {}),
      },
      include: {
        proveedor: true,
        pago_proveedor: true,
      },
      orderBy: {
        fecha_compra: "desc",
      },
      take: 100,
    }),
  ]);

  const incomeMovements = cashMovements.filter((movement) => {
    return movement.tipo_movimiento === "ingreso";
  });

  const expenseMovements = cashMovements.filter((movement) => {
    return movement.tipo_movimiento === "egreso";
  });

  const totalCashIncome = incomeMovements.reduce((sum, movement) => {
    return sum + toNumber(movement.monto);
  }, 0);

  const totalCashExpense = expenseMovements.reduce((sum, movement) => {
    return sum + toNumber(movement.monto);
  }, 0);

  const cashNetMovement = totalCashIncome - totalCashExpense;

  const totalOpenCashBalance = openCashBoxesBalance._sum.saldo_actual ?? 0;
  const totalCollectedPayments = collectedPayments._sum.monto_pagado ?? 0;

  const totalProductionCost = productionCosts._sum.costo_total ?? 0;
  const totalMaterialCost = productionCosts._sum.costo_materiales ?? 0;
  const totalConsumableCost = productionCosts._sum.costo_consumibles ?? 0;
  const totalLaborCost = productionCosts._sum.costo_mano_obra ?? 0;
  const totalIndirectCost = productionCosts._sum.costo_indirecto_total ?? 0;

  const totalEstimatedIncome = estimatedProfit._sum.ingreso_estimado ?? 0;
  const totalEstimatedCost = estimatedProfit._sum.costo_total ?? 0;
  const totalEstimatedProfit = estimatedProfit._sum.utilidad_estimada ?? 0;

  const totalReceivables = receivables._sum.saldo ?? 0;

  const supplierPendingRows = pendingSupplierPurchases.map((purchase) => {
    const paidAmount = getPaidSupplierAmount(purchase.pago_proveedor);
    const pendingBalance = Math.max(toNumber(purchase.monto_total) - paidAmount, 0);

    return {
      purchase,
      paidAmount,
      pendingBalance,
    };
  });

  const totalSupplierPendingBalance = supplierPendingRows.reduce((sum, row) => {
    return sum + row.pendingBalance;
  }, 0);

  const financialEstimatedResult =
    toNumber(totalCollectedPayments) +
    totalCashIncome -
    totalCashExpense -
    toNumber(totalProductionCost);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reporte financiero"
        description="Consulta caja chica, ingresos, egresos, costos de producción, utilidad estimada, cuentas por cobrar y compras pendientes de pago."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Reportes", href: navigationHrefs.reports },
          { label: "Financiero" },
        ])}
        actions={
          <>
            <Button asChild>
              <a href={csvExportHref}>Exportar Excel</a>
            </Button>

            <Button variant="destructive" asChild>
              <a href={pdfExportHref}>Exportar PDF</a>
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros del reporte</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Fecha desde</Label>
              <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Fecha hasta</Label>
              <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cashBoxId">Caja chica</Label>
              <NativeSelect id="cashBoxId" name="cashBoxId" defaultValue={cashBoxId}>
                <option value="">Todas las cajas</option>
                {cashBoxes.map((cashBox) => (
                  <option key={cashBox.id_caja_chica} value={cashBox.id_caja_chica}>
                    {cashBox.nombre_caja}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="movementType">Tipo movimiento</Label>
              <NativeSelect id="movementType" name="movementType" defaultValue={movementType}>
                <option value="">Todos los tipos</option>
                {CASH_MOVEMENT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoría</Label>
              <NativeSelect id="categoryId" name="categoryId" defaultValue={categoryId}>
                <option value="">Todas las categorías</option>
                {categories.map((category) => (
                  <option
                    key={category.id_categoria_gasto}
                    value={category.id_categoria_gasto}
                  >
                    {category.nombre_categoria}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="searchText">Concepto / responsable</Label>
              <Input
                id="searchText"
                name="searchText"
                type="text"
                defaultValue={searchText}
                placeholder="Ej: transporte, repuesto..."
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-6">
              <Button type="submit">Aplicar filtros</Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/reports/financial">
                  Limpiar filtros
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Saldo caja chica" value={formatMoney(totalOpenCashBalance)} description="Saldo actual acumulado de cajas abiertas." tone="info" icon={Landmark} />
        <KpiCard title="Ingresos caja chica" value={formatMoney(totalCashIncome)} description="Ingresos menores según filtros aplicados." tone="success" icon={TrendingUp} />
        <KpiCard title="Egresos caja chica" value={formatMoney(totalCashExpense)} description="Gastos menores registrados según filtros." tone="warning" icon={TrendingDown} />
        <KpiCard title="Movimiento neto" value={formatMoney(cashNetMovement)} description="Ingresos menos egresos de caja chica." tone="info" icon={Scale} />
        <KpiCard title="Cobrado a clientes" value={formatMoney(totalCollectedPayments)} description="Pagos de clientes registrados en el periodo." tone="success" icon={CircleDollarSign} />
        <KpiCard title="Cuentas por cobrar" value={formatMoney(totalReceivables)} description="Saldo pendiente de proformas activas." tone="info" icon={Landmark} />
        <KpiCard title="Compras por pagar" value={formatMoney(totalSupplierPendingBalance)} description={`Compras pendientes o parciales: ${supplierPendingRows.length}.`} tone={supplierPendingRows.length > 0 ? "warning" : "info"} icon={Truck} />
        <KpiCard title="Resultado estimado" value={formatMoney(financialEstimatedResult)} description="Cobros + ingresos caja - egresos - costos." tone="info" icon={Scale} />
        <KpiCard title="Costo producción" value={formatMoney(totalProductionCost)} description="Costos de producción registrados en costeo." tone="info" icon={CircleDollarSign} />
        <KpiCard title="Utilidad estimada" value={formatMoney(totalEstimatedProfit)} description={`Alertas de bajo margen: ${lowMarginAlerts}.`} tone={lowMarginAlerts > 0 ? "warning" : "success"} icon={TrendingUp} />
        <KpiCard title="Ingreso estimado" value={formatMoney(totalEstimatedIncome)} description="Ingreso estimado registrado en rentabilidad." tone="info" icon={TrendingUp} />
        <KpiCard title="Costo estimado" value={formatMoney(totalEstimatedCost)} description="Costo total usado en cálculo de rentabilidad." tone="info" icon={CircleDollarSign} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Desglose de costos de producción
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border/80 bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Materiales</p>
                <p className="text-xl font-bold text-foreground">
                  {formatMoney(totalMaterialCost)}
                </p>
              </div>

              <div className="rounded-lg border border-border/80 bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Consumibles</p>
                <p className="text-xl font-bold text-foreground">
                  {formatMoney(totalConsumableCost)}
                </p>
              </div>

              <div className="rounded-lg border border-border/80 bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">Mano de obra</p>
                <p className="text-xl font-bold text-foreground">
                  {formatMoney(totalLaborCost)}
                </p>
              </div>

              <div className="rounded-lg border border-border/80 bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">
                  Costos indirectos
                </p>
                <p className="text-xl font-bold text-foreground">
                  {formatMoney(totalIndirectCost)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Saldos pendientes a proveedores
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {supplierPendingRows.length === 0 ? (
              <EmptyState label="No hay compras pendientes de pago en el periodo filtrado." />
            ) : (
              supplierPendingRows.slice(0, 5).map((row) => (
                <div
                  key={row.purchase.id_compra}
                  className="rounded-lg border border-border/80 bg-secondary/40 p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{row.purchase.id_compra}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.purchase.proveedor.razon_social} ·{" "}
                        {formatDate(row.purchase.fecha_compra)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-foreground">
                        {formatMoney(row.pendingBalance)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.purchase.estado_pago}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Movimientos de caja chica
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {cashMovements.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron movimientos de caja con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Movimiento</TableHead>
                  <TableHead>Caja</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Comprobante</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {cashMovements.map((movement) => (
                  <TableRow key={movement.id_movimiento_caja}>
                    <TableCell className="font-medium">
                      {movement.id_movimiento_caja}
                    </TableCell>

                    <TableCell>{movement.caja_chica.nombre_caja}</TableCell>

                    <TableCell>{formatDate(movement.fecha_movimiento)}</TableCell>

                    <TableCell>
                      {getCashMovementTypeLabel(movement.tipo_movimiento)}
                    </TableCell>

                    <TableCell>{movement.concepto}</TableCell>

                    <TableCell>
                      {movement.categoria_gasto?.nombre_categoria ?? "-"}
                    </TableCell>

                    <TableCell>{formatMoney(movement.monto)}</TableCell>

                    <TableCell>{movement.responsable ?? "-"}</TableCell>

                    <TableCell>
                      {movement.usuario.apellidos}, {movement.usuario.nombres}
                    </TableCell>

                    <TableCell>{movement.comprobante ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <p className="mt-3 px-6 text-xs text-muted-foreground">
            Se muestran como máximo 100 movimientos de caja para mantener una
            consulta rápida. En la subfase de exportación se generarán archivos
            completos según los filtros aplicados.
          </p>
        </CardContent>
      </Card>

      <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Este reporte consolida información financiera del taller: caja chica,
          ingresos menores, egresos, cobranzas, costos de producción,
          rentabilidad estimada, cuentas por cobrar y compras pendientes de pago.
        </p>
      </section>
    </div>
  );
}

