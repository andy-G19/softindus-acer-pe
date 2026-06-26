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

const PURCHASE_STATUS_OPTIONS = [
  { value: "registrada", label: "Registrada" },
  { value: "confirmada", label: "Confirmada" },
  { value: "anulada", label: "Anulada" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "parcial", label: "Parcial" },
  { value: "pagado", label: "Pagado" },
];

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

function getPurchaseStatusLabel(status: string) {
  return (
    PURCHASE_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function getPaymentStatusLabel(status: string) {
  return (
    PAYMENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status
  );
}

function getPaidAmount(
  payments: {
    monto_pagado: unknown;
  }[],
) {
  return payments.reduce((sum, payment) => {
    return sum + toNumber(payment.monto_pagado);
  }, 0);
}

type SummaryCardProps = {
  title: string;
  value: string | number;
  description: string;
};

function SummaryCard({ title, value, description }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>

      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default async function SuppliersPurchasesReportPage({
  searchParams,
}: PageProps) {
  await requireRole([APP_ROLES.ADMIN]);

  const params = searchParams ? await searchParams : {};

  const dateFrom = getSearchParam(params, "dateFrom");
  const dateTo = getSearchParam(params, "dateTo");
  const supplierId = getSearchParam(params, "supplierId");
  const materialId = getSearchParam(params, "materialId");
  const purchaseStatus = getSearchParam(params, "purchaseStatus");
  const paymentStatus = getSearchParam(params, "paymentStatus");
  const searchCode = getSearchParam(params, "searchCode").trim();

  const fromDate = parseDateInput(dateFrom);
  const toDate = parseDateInputAsNextDay(dateTo);
  const normalizedCode = searchCode.toUpperCase();

  const purchaseWhere = {
    ...(fromDate || toDate
      ? {
          fecha_compra: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lt: toDate } : {}),
          },
        }
      : {}),
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
    ...(normalizedCode
      ? {
          OR: [
            {
              id_compra: {
                contains: normalizedCode,
              },
            },
            {
              numero_comprobante: {
                contains: normalizedCode,
              },
            },
          ],
        }
      : {}),
  };

  const [suppliers, materials, purchases] = await Promise.all([
    prisma.proveedor.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        razon_social: "asc",
      },
    }),

    prisma.material.findMany({
      where: {
        estado: true,
      },
      orderBy: {
        nombre_material: "asc",
      },
    }),

    prisma.compra.findMany({
      where: purchaseWhere,
      orderBy: {
        fecha_compra: "desc",
      },
      take: 100,
      include: {
        proveedor: true,
        usuario: true,
        detalle_compra: {
          include: {
            material: true,
          },
          orderBy: {
            id_detalle_compra: "asc",
          },
        },
        pago_proveedor: {
          orderBy: {
            fecha_pago: "asc",
          },
        },
        historial_precio_proveedor: {
          include: {
            material: true,
          },
          orderBy: {
            fecha_registro: "desc",
          },
          take: 5,
        },
      },
    }),
  ]);

  const reportRows = purchases.map((purchase) => {
    const paidAmount = getPaidAmount(purchase.pago_proveedor);
    const pendingBalance = Math.max(toNumber(purchase.monto_total) - paidAmount, 0);

    const purchasedQuantity = purchase.detalle_compra.reduce((sum, detail) => {
      return sum + toNumber(detail.cantidad);
    }, 0);

    const materialsCount = new Set(
      purchase.detalle_compra.map((detail) => detail.id_material),
    ).size;

    return {
      purchase,
      paidAmount,
      pendingBalance,
      purchasedQuantity,
      materialsCount,
    };
  });

  const totalPurchases = reportRows.length;

  const totalPurchaseAmount = reportRows.reduce((sum, row) => {
    return sum + toNumber(row.purchase.monto_total);
  }, 0);

  const totalPaidAmount = reportRows.reduce((sum, row) => {
    return sum + row.paidAmount;
  }, 0);

  const totalPendingBalance = reportRows.reduce((sum, row) => {
    return sum + row.pendingBalance;
  }, 0);

  const pendingPurchases = reportRows.filter((row) => {
    return row.purchase.estado_pago === "pendiente";
  }).length;

  const partialPurchases = reportRows.filter((row) => {
    return row.purchase.estado_pago === "parcial";
  }).length;

  const paidPurchases = reportRows.filter((row) => {
    return row.purchase.estado_pago === "pagado";
  }).length;

  const totalPurchasedQuantity = reportRows.reduce((sum, row) => {
    return sum + row.purchasedQuantity;
  }, 0);

  const uniqueSuppliers = new Set(
    reportRows.map((row) => row.purchase.id_proveedor),
  ).size;

  const uniqueMaterials = new Set(
    reportRows.flatMap((row) => {
      return row.purchase.detalle_compra.map((detail) => detail.id_material);
    }),
  ).size;

  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Fase 10 · Subfase 10.3.4
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Reporte de proveedores y compras
          </h1>
          <p className="mt-2 max-w-4xl text-muted-foreground">
            Consulta compras realizadas, proveedores, materiales adquiridos,
            comprobantes, montos, pagos, saldos pendientes y precios históricos.
          </p>
        </div>

        <Link
          href="/dashboard/reports"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Volver al dashboard
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros del reporte</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <div className="space-y-2">
              <label htmlFor="dateFrom" className="text-sm font-medium">
                Fecha desde
              </label>
              <input
                id="dateFrom"
                name="dateFrom"
                type="date"
                defaultValue={dateFrom}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="dateTo" className="text-sm font-medium">
                Fecha hasta
              </label>
              <input
                id="dateTo"
                name="dateTo"
                type="date"
                defaultValue={dateTo}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="supplierId" className="text-sm font-medium">
                Proveedor
              </label>
              <select
                id="supplierId"
                name="supplierId"
                defaultValue={supplierId}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los proveedores</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id_proveedor} value={supplier.id_proveedor}>
                    {supplier.razon_social}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="materialId" className="text-sm font-medium">
                Material
              </label>
              <select
                id="materialId"
                name="materialId"
                defaultValue={materialId}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los materiales</option>
                {materials.map((material) => (
                  <option key={material.id_material} value={material.id_material}>
                    {material.nombre_material}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="purchaseStatus" className="text-sm font-medium">
                Estado compra
              </label>
              <select
                id="purchaseStatus"
                name="purchaseStatus"
                defaultValue={purchaseStatus}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los estados</option>
                {PURCHASE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="paymentStatus" className="text-sm font-medium">
                Estado pago
              </label>
              <select
                id="paymentStatus"
                name="paymentStatus"
                defaultValue={paymentStatus}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Todos los estados</option>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="searchCode" className="text-sm font-medium">
                Compra o comprobante
              </label>
              <input
                id="searchCode"
                name="searchCode"
                type="text"
                defaultValue={searchCode}
                placeholder="Ej: COM00000001"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="flex gap-2 md:col-span-2 xl:col-span-7">
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                Aplicar filtros
              </button>

              <Link
                href="/dashboard/reports/suppliers-purchases"
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                Limpiar filtros
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Compras encontradas"
          value={totalPurchases}
          description="Compras según los filtros aplicados."
        />

        <SummaryCard
          title="Monto comprado"
          value={formatMoney(totalPurchaseAmount)}
          description="Suma total de compras encontradas."
        />

        <SummaryCard
          title="Monto pagado"
          value={formatMoney(totalPaidAmount)}
          description="Pagos registrados a proveedores."
        />

        <SummaryCard
          title="Saldo pendiente"
          value={formatMoney(totalPendingBalance)}
          description="Monto estimado aún pendiente de pago."
        />

        <SummaryCard
          title="Compras pendientes"
          value={pendingPurchases}
          description={`Parciales: ${partialPurchases}. Pagadas: ${paidPurchases}.`}
        />

        <SummaryCard
          title="Proveedores"
          value={uniqueSuppliers}
          description="Proveedores presentes en el reporte."
        />

        <SummaryCard
          title="Materiales distintos"
          value={uniqueMaterials}
          description="Materiales comprados en el periodo filtrado."
        />

        <SummaryCard
          title="Cantidad comprada"
          value={formatQuantity(totalPurchasedQuantity)}
          description="Suma general de cantidades compradas."
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado del reporte
          </CardTitle>
        </CardHeader>

        <CardContent>
          {reportRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No se encontraron compras con los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Compra</th>
                    <th className="py-2 pr-3 font-medium">Proveedor</th>
                    <th className="py-2 pr-3 font-medium">Fecha</th>
                    <th className="py-2 pr-3 font-medium">Comprobante</th>
                    <th className="py-2 pr-3 font-medium">Materiales</th>
                    <th className="py-2 pr-3 font-medium">Monto total</th>
                    <th className="py-2 pr-3 font-medium">Pagado</th>
                    <th className="py-2 pr-3 font-medium">Saldo</th>
                    <th className="py-2 pr-3 font-medium">Estado compra</th>
                    <th className="py-2 pr-3 font-medium">Estado pago</th>
                    <th className="py-2 pr-3 font-medium">Precios históricos</th>
                  </tr>
                </thead>

                <tbody>
                  {reportRows.map((row) => (
                    <tr key={row.purchase.id_compra} className="border-b align-top">
                      <td className="py-2 pr-3 font-medium">
                        {row.purchase.id_compra}
                      </td>

                      <td className="py-2 pr-3">
                        <div>
                          <p className="font-medium">
                            {row.purchase.proveedor.razon_social}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.purchase.proveedor.tipo_proveedor}
                          </p>
                        </div>
                      </td>

                      <td className="py-2 pr-3">
                        {formatDate(row.purchase.fecha_compra)}
                      </td>

                      <td className="py-2 pr-3">
                        <div>
                          <p>
                            {row.purchase.tipo_comprobante ?? "-"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.purchase.numero_comprobante ?? "Sin número"}
                          </p>
                        </div>
                      </td>

                      <td className="min-w-72 py-2 pr-3">
                        <div className="space-y-2">
                          {row.purchase.detalle_compra.map((detail) => (
                            <div
                              key={detail.id_detalle_compra}
                              className="rounded-md border p-2"
                            >
                              <p className="font-medium">
                                {detail.material.nombre_material}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatQuantity(detail.cantidad)}{" "}
                                {detail.unidad_medida} ·{" "}
                                {formatMoney(detail.costo_unitario)} c/u ·{" "}
                                subtotal {formatMoney(detail.subtotal)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="py-2 pr-3">
                        {formatMoney(row.purchase.monto_total)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatMoney(row.paidAmount)}
                      </td>

                      <td className="py-2 pr-3">
                        {formatMoney(row.pendingBalance)}
                      </td>

                      <td className="py-2 pr-3">
                        {getPurchaseStatusLabel(row.purchase.estado_compra)}
                      </td>

                      <td className="py-2 pr-3">
                        {getPaymentStatusLabel(row.purchase.estado_pago)}
                      </td>

                      <td className="min-w-64 py-2 pr-3">
                        {row.purchase.historial_precio_proveedor.length === 0 ? (
                          <span className="text-muted-foreground">
                            Sin historial
                          </span>
                        ) : (
                          <div className="space-y-2">
                            {row.purchase.historial_precio_proveedor.map(
                              (history) => (
                                <div
                                  key={history.id_historial_precio}
                                  className="rounded-md border p-2"
                                >
                                  <p className="font-medium">
                                    {history.material.nombre_material}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatMoney(history.precio_unitario)} ·{" "}
                                    {formatDate(history.fecha_registro)} ·{" "}
                                    {history.origen_registro}
                                  </p>
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Se muestran como máximo 100 compras para mantener una consulta
            rápida. En la subfase de exportación se generarán archivos completos
            según los filtros aplicados.
          </p>
        </CardContent>
      </Card>

      <section className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p>
          Este reporte consolida la trazabilidad de abastecimiento: proveedor,
          compra, comprobante, materiales adquiridos, precios unitarios,
          historial de precios, pagos realizados y saldo pendiente.
        </p>
      </section>
    </div>
  );
}