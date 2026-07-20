import {
  Calculator,
  CircleDollarSign,
  ClipboardList,
  Landmark,
  Package,
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

  const csvExportHref = buildReportExportHref("suppliers-purchases", {
    dateFrom,
    dateTo,
    supplierId,
    materialId,
    purchaseStatus,
    paymentStatus,
    searchCode,
  });

  const pdfExportHref = buildReportExportHref(
  "suppliers-purchases",
  {
    dateFrom,
    dateTo,
    supplierId,
    materialId,
    purchaseStatus,
    paymentStatus,
    searchCode,
  },
  "pdf",
  );

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
      <PageHeader
        title="Reporte de proveedores y compras"
        description="Consulta compras realizadas, proveedores, materiales adquiridos, comprobantes, montos, pagos, saldos pendientes y precios históricos."
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Reportes", href: navigationHrefs.reports },
          { label: "Proveedores y compras" },
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
          <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Fecha desde</Label>
              <Input id="dateFrom" name="dateFrom" type="date" defaultValue={dateFrom} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateTo">Fecha hasta</Label>
              <Input id="dateTo" name="dateTo" type="date" defaultValue={dateTo} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplierId">Proveedor</Label>
              <NativeSelect id="supplierId" name="supplierId" defaultValue={supplierId}>
                <option value="">Todos los proveedores</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id_proveedor} value={supplier.id_proveedor}>
                    {supplier.razon_social}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="materialId">Material</Label>
              <NativeSelect id="materialId" name="materialId" defaultValue={materialId}>
                <option value="">Todos los materiales</option>
                {materials.map((material) => (
                  <option key={material.id_material} value={material.id_material}>
                    {material.nombre_material}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchaseStatus">Estado compra</Label>
              <NativeSelect id="purchaseStatus" name="purchaseStatus" defaultValue={purchaseStatus}>
                <option value="">Todos los estados</option>
                {PURCHASE_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentStatus">Estado pago</Label>
              <NativeSelect id="paymentStatus" name="paymentStatus" defaultValue={paymentStatus}>
                <option value="">Todos los estados</option>
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="searchCode">Compra o comprobante</Label>
              <Input
                id="searchCode"
                name="searchCode"
                type="text"
                defaultValue={searchCode}
                placeholder="Ej: COM00000001"
              />
            </div>

            <div className="flex items-end gap-2 md:col-span-2 xl:col-span-7">
              <Button type="submit">Aplicar filtros</Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard/reports/suppliers-purchases">
                  Limpiar filtros
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Compras encontradas" value={totalPurchases.toString()} description="Compras según los filtros aplicados." tone="info" icon={ClipboardList} />
        <KpiCard title="Monto comprado" value={formatMoney(totalPurchaseAmount)} description="Suma total de compras encontradas." tone="info" icon={CircleDollarSign} />
        <KpiCard title="Monto pagado" value={formatMoney(totalPaidAmount)} description="Pagos registrados a proveedores." tone="success" icon={CircleDollarSign} />
        <KpiCard title="Saldo pendiente" value={formatMoney(totalPendingBalance)} description="Monto estimado aún pendiente de pago." tone={totalPendingBalance > 0 ? "warning" : "info"} icon={Landmark} />
        <KpiCard title="Compras pendientes" value={pendingPurchases.toString()} description={`Parciales: ${partialPurchases}. Pagadas: ${paidPurchases}.`} tone={pendingPurchases > 0 ? "warning" : "info"} icon={Truck} />
        <KpiCard title="Proveedores" value={uniqueSuppliers.toString()} description="Proveedores presentes en el reporte." tone="info" icon={Truck} />
        <KpiCard title="Materiales distintos" value={uniqueMaterials.toString()} description="Materiales comprados en el periodo filtrado." tone="info" icon={Package} />
        <KpiCard title="Cantidad comprada" value={formatQuantity(totalPurchasedQuantity)} description="Suma general de cantidades compradas." tone="info" icon={Calculator} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Resultado del reporte
          </CardTitle>
        </CardHeader>

        <CardContent className="px-0">
          {reportRows.length === 0 ? (
            <EmptyState
              className="mx-6 border-0"
              label="No se encontraron compras con los filtros aplicados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compra</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Comprobante</TableHead>
                  <TableHead>Materiales</TableHead>
                  <TableHead>Monto total</TableHead>
                  <TableHead>Pagado</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Estado compra</TableHead>
                  <TableHead>Estado pago</TableHead>
                  <TableHead>Precios históricos</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {reportRows.map((row) => (
                  <TableRow key={row.purchase.id_compra} className="align-top">
                    <TableCell className="font-medium">
                      {row.purchase.id_compra}
                    </TableCell>

                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {row.purchase.proveedor.razon_social}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.purchase.proveedor.tipo_proveedor}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>{formatDate(row.purchase.fecha_compra)}</TableCell>

                    <TableCell>
                      <div>
                        <p>{row.purchase.tipo_comprobante ?? "-"}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.purchase.numero_comprobante ?? "Sin número"}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="min-w-72">
                      <div className="space-y-2">
                        {row.purchase.detalle_compra.map((detail) => (
                          <div
                            key={detail.id_detalle_compra}
                            className="rounded-md border border-border/80 bg-secondary/40 p-2"
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
                    </TableCell>

                    <TableCell>{formatMoney(row.purchase.monto_total)}</TableCell>

                    <TableCell>{formatMoney(row.paidAmount)}</TableCell>

                    <TableCell>{formatMoney(row.pendingBalance)}</TableCell>

                    <TableCell>
                      {getPurchaseStatusLabel(row.purchase.estado_compra)}
                    </TableCell>

                    <TableCell>
                      {getPaymentStatusLabel(row.purchase.estado_pago)}
                    </TableCell>

                    <TableCell className="min-w-64">
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
                                className="rounded-md border border-border/80 bg-secondary/40 p-2"
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <p className="mt-3 px-6 text-xs text-muted-foreground">
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

