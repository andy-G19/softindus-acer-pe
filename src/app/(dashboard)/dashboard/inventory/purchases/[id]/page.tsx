import { redirect } from "next/navigation";
import { requireRole } from "@/lib/authz";
import { PageHeader } from "@/components/navigation/page-header";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteButton } from "@/components/notifications/confirm-delete-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/db";
import {
  dashboardBreadcrumbs,
  getSafeReturnTo,
  navigationHrefs,
} from "@/lib/navigation";
import { SupplierPaymentForm } from "@/components/inventory/supplier-payment-form";
import { annulPurchaseAction } from "@/modules/inventory/purchases/actions";

function formatMoney(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `S/ ${Number(value.toString()).toFixed(2)}`;
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("es-PE").format(new Date(value));
}

type PurchaseDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PurchaseDetailPage({
  params,
  searchParams,
}: PurchaseDetailPageProps) {
  await requireRole(["ADMIN"]);

  const { id } = await params;
  const queryParams = (await searchParams) ?? {};

  const purchase = await prisma.compra.findUnique({
    where: {
      id_compra: id,
    },
  });

  if (!purchase) {
    redirect("/dashboard/inventory/purchases");
  }

  const [supplier, details, payments] = await Promise.all([
    prisma.proveedor.findUnique({
      where: {
        id_proveedor: purchase.id_proveedor,
      },
    }),
    prisma.detalle_compra.findMany({
      where: {
        id_compra: purchase.id_compra,
      },
      orderBy: {
        id_detalle_compra: "asc",
      },
    }),
    prisma.pago_proveedor.findMany({
      where: {
        id_compra: purchase.id_compra,
      },
      orderBy: {
        fecha_pago: "desc",
      },
    }),
  ]);

  const materialIds = details.map((detail) => detail.id_material);

  const materials = await prisma.material.findMany({
    where: {
      id_material: {
        in: materialIds,
      },
    },
  });

  const materialById = new Map(
    materials.map((material) => [material.id_material, material]),
  );

  const totalPaid = payments.reduce((acc, payment) => {
    return acc + Number(payment.monto_pagado.toString());
  }, 0);

  const purchaseTotal = Number(purchase.monto_total.toString());
  const saldoPendiente = purchaseTotal - totalPaid;
  const canPay = purchase.estado_compra !== "anulada" && saldoPendiente > 0;
  const canAnnul = purchase.estado_compra !== "anulada" && payments.length === 0;
  const backHref = getSafeReturnTo(
    queryParams.returnTo,
    navigationHrefs.purchases,
  );

  return (
    <main className="space-y-6">
      <PageHeader
        title="Detalle de compra"
        description="Consulta los materiales adquiridos, montos, comprobante y estado de pago."
        backHref={backHref}
        backLabel="Volver a compras"
        breadcrumbs={dashboardBreadcrumbs([
          { label: "Inventario", href: navigationHrefs.inventory },
          { label: "Compras", href: backHref },
          { label: purchase.id_compra },
        ])}
        actions={
          canAnnul ? (
            <form action={annulPurchaseAction}>
              <input type="hidden" name="id_compra" value={purchase.id_compra} />
              <ConfirmDeleteButton
                title="¿Anular compra?"
                description="Esta acción anulará la compra y no se puede deshacer."
                confirmText="Confirmar anulación"
                entityName="compra"
              >
                Anular compra
              </ConfirmDeleteButton>
            </form>
          ) : null
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard
          title="Proveedor"
          value={supplier?.razon_social ?? purchase.id_proveedor}
          description="Proveedor de la compra."
        />
        <KpiCard
          title="Total compra"
          value={formatMoney(purchase.monto_total)}
          description="Monto total registrado."
          tone="info"
        />
        <KpiCard
          title="Pagado"
          value={`S/ ${totalPaid.toFixed(2)}`}
          description="Suma de pagos registrados."
          tone="success"
        />
        <KpiCard
          title="Saldo pendiente"
          value={`S/ ${saldoPendiente.toFixed(2)}`}
          description="Monto restante por pagar."
          tone="warning"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la compra</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <p className="text-sm">
              <span className="font-medium">Fecha:</span>{" "}
              {formatDate(purchase.fecha_compra)}
            </p>

            <p className="text-sm">
              <span className="font-medium">Comprobante:</span>{" "}
              {purchase.numero_comprobante
                ? `${purchase.tipo_comprobante ?? "-"} ${purchase.numero_comprobante}`
                : "-"}
            </p>

            <p className="text-sm">
              <span className="font-medium">Estado de pago:</span>{" "}
              <Badge
                variant={
                  purchase.estado_pago === "pagado" ? "success" : "secondary"
                }
              >
                {purchase.estado_pago}
              </Badge>
            </p>

            <p className="text-sm">
              <span className="font-medium">Subtotal:</span>{" "}
              {formatMoney(purchase.subtotal)}
            </p>

            <p className="text-sm">
              <span className="font-medium">IGV:</span>{" "}
              {formatMoney(purchase.igv)}
            </p>

            <p className="text-sm">
              <span className="font-medium">Estado compra:</span>{" "}
              <Badge
                variant={
                  purchase.estado_compra === "anulada"
                    ? "destructive"
                    : "secondary"
                }
              >
                {purchase.estado_compra}
              </Badge>
            </p>
          </div>

          {purchase.observaciones ? (
            <p className="mt-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                Observaciones:
              </span>{" "}
              {purchase.observaciones}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Materiales comprados</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead>Costo unitario</TableHead>
                <TableHead>Subtotal</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {details.map((detail) => {
                const material = materialById.get(detail.id_material);

                return (
                  <TableRow key={detail.id_detalle_compra}>
                    <TableCell className="font-medium">
                      {material?.nombre_material ?? detail.id_material}
                    </TableCell>
                    <TableCell>
                      {Number(detail.cantidad.toString()).toFixed(2)}
                    </TableCell>
                    <TableCell>{detail.unidad_medida}</TableCell>
                    <TableCell>
                      {formatMoney(detail.costo_unitario)}
                    </TableCell>
                    <TableCell>{formatMoney(detail.subtotal)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canPay ? (
        <SupplierPaymentForm
          idCompra={purchase.id_compra}
          saldoPendiente={saldoPendiente}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de pagos</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Monto</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Saldo posterior</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id_pago_proveedor}>
                  <TableCell>{formatDate(payment.fecha_pago)}</TableCell>
                  <TableCell>{formatMoney(payment.monto_pagado)}</TableCell>
                  <TableCell>{payment.metodo_pago}</TableCell>
                  <TableCell>
                    {formatMoney(payment.saldo_pendiente)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        payment.estado_pago === "pagado"
                          ? "success"
                          : "secondary"
                      }
                    >
                      {payment.estado_pago}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}

              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-0">
                    <EmptyState
                      className="border-0"
                      label="Todavía no hay pagos registrados para esta compra."
                    />
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
