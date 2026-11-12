import { notFound } from "next/navigation";

import { requireRole } from "@/lib/authz";
import { hasCents } from "@/lib/client-payment-amounts";
import { PrintButton } from "@/components/commercial/print-button";
import { PageHeader } from "@/components/navigation/page-header";
import { formatDate, formatMoney } from "@/lib/formatters";
import { dashboardBreadcrumbs, getSafeReturnTo, navigationHrefs } from "@/lib/navigation";
import type { SearchParamsRecord } from "@/lib/search-params";
import { StateBadge } from "@/components/commercial/status-badge";
import { commercialNotifications } from "@/modules/commercial/notifications";
import {
  getOptionLabel,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_TYPE_OPTIONS,
  RECEIPT_TYPE_OPTIONS,
} from "@/modules/commercial/payment-labels";
import { createPaymentAction } from "@/modules/commercial/payments/actions";
import { createReceiptAction } from "@/modules/commercial/receipts/actions";
import { ReceiptForm } from "@/modules/commercial/receipts/receipt-form";
import { PaymentForm } from "@/modules/commercial/payments/payment-form";
import { annulQuoteAction } from "@/modules/commercial/quotes/actions";
import { QuoteAnnulAction } from "@/modules/commercial/quotes/quote-annul-action";
import { getQuoteDetail } from "@/modules/commercial/quotes/queries";

type QuoteDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<SearchParamsRecord>;
};

// C5 de la 11.3c (D40, hallazgo 5 de la 10.4b): los listados que abren este detalle, con el texto
// de su miga de pan y de «Volver». Un `returnTo` cuya ruta no es exactamente una de estas (otro
// modulo, una ruta parecida) vuelve a proformas: asi el texto nunca nombra un listado y lleva a
// otro. El primero es el de siempre.
const QUOTE_DETAIL_ORIGINS = [
  { href: navigationHrefs.quotes, label: "Proformas", backLabel: "Volver a proformas" },
  { href: navigationHrefs.customerPayments, label: "Pagos de cliente", backLabel: "Volver a pagos de cliente" },
  { href: navigationHrefs.salesReceipts, label: "Comprobantes de venta", backLabel: "Volver a comprobantes" },
  { href: navigationHrefs.orders, label: "Pedidos", backLabel: "Volver a pedidos" },
] as const;

function resolveQuoteDetailOrigin(returnTo: string | string[] | undefined) {
  const [defaultOrigin] = QUOTE_DETAIL_ORIGINS;
  const safeHref = getSafeReturnTo(returnTo, defaultOrigin.href);
  const pathname = safeHref.split(/[?#]/)[0];
  const origin = QUOTE_DETAIL_ORIGINS.find((item) => item.href === pathname);

  return origin ? { ...origin, href: safeHref } : defaultOrigin;
}

function calculateExpirationDate(
  issueDate: Date,
  validityDays: number | null
) {
  if (!validityDays) {
    return null;
  }

  const expirationDate = new Date(issueDate);
  expirationDate.setDate(expirationDate.getDate() + validityDays);

  return expirationDate;
}

export default async function QuoteDetailPage({
  params,
  searchParams,
}: QuoteDetailPageProps) {
  const { id } = await params;

  await requireRole(["ADMIN", "SELLER"]);

  const origin = resolveQuoteDetailOrigin(((await searchParams) ?? {}).returnTo);

  const quote = await getQuoteDetail(id);

  if (!quote) {
    notFound();
  }

  const expirationDate = calculateExpirationDate(
    quote.fecha_emision,
    quote.validez_dias
  );

  const activeReceipt = quote.comprobante_venta.find(
    (receipt) => receipt.estado === "emitido"
  );
  const canAnnul =
    quote.estado !== "anulada" &&
    quote.pago_cliente.length === 0 &&
    !activeReceipt;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Detalle de proforma"
          description="Revisa, imprime o guarda la proforma como PDF desde el navegador."
          backHref={origin.href}
          backLabel={origin.backLabel}
          breadcrumbs={dashboardBreadcrumbs([
            { label: "Comercial", href: navigationHrefs.commercial },
            { label: origin.label, href: origin.href },
            { label: "Detalle de proforma" },
          ])}
          actions={
            <>
              <PrintButton />

              {canAnnul ? (
                <QuoteAnnulAction
                  quote={quote}
                  action={annulQuoteAction}
                  successNotification={commercialNotifications["quote-annulled"]}
                />
              ) : null}
            </>
          }
        />
      </div>

      <section className="rounded-lg border bg-background p-8 print:border-0 print:p-0">
        <div className="space-y-8">
          <header className="flex items-start justify-between gap-6 border-b pb-6">
            <div>
              <h2 className="text-2xl font-bold uppercase">
                Industrias Aceros Perú
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Taller metalúrgico especializado en herramientas agrícolas,
                productos metálicos y estructuras.
              </p>
              <div className="mt-4 space-y-1 text-sm">
                <p>
                  <span className="font-medium">Documento:</span> Proforma
                  comercial
                </p>
                <p>
                  <span className="font-medium">Pedido asociado:</span>{" "}
                  {quote.id_pedido}
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-4 text-right">
              <p className="text-xs uppercase text-muted-foreground">
                N° Proforma
              </p>
              <p className="text-xl font-bold">{quote.numero_proforma}</p>
              <p className="mt-3 text-sm">
                <span className="font-medium">Emisión:</span>{" "}
                {formatDate(quote.fecha_emision)}
              </p>
              <p className="text-sm">
                <span className="font-medium">Validez:</span>{" "}
                {quote.validez_dias ? `${quote.validez_dias} días` : "-"}
              </p>
              <p className="text-sm">
                <span className="font-medium">Vence:</span>{" "}
                {formatDate(expirationDate)}
              </p>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Datos del cliente</h3>

              <div className="mt-3 space-y-1 text-sm">
                <p>
                  <span className="font-medium">Cliente:</span>{" "}
                  {quote.pedido.cliente.nombre_razon_social}
                </p>
                <p>
                  <span className="font-medium">Tipo:</span>{" "}
                  {quote.pedido.cliente.tipo_cliente}
                </p>
                <p>
                  <span className="font-medium">Documento:</span>{" "}
                  {quote.pedido.cliente.tipo_documento ?? "-"}{" "}
                  {quote.pedido.cliente.numero_documento ?? ""}
                </p>
                <p>
                  <span className="font-medium">Teléfono:</span>{" "}
                  {quote.pedido.cliente.telefono ?? "-"}
                </p>
                <p>
                  <span className="font-medium">Correo:</span>{" "}
                  {quote.pedido.cliente.correo ?? "-"}
                </p>
                <p>
                  <span className="font-medium">Dirección:</span>{" "}
                  {quote.pedido.cliente.direccion ?? "-"}
                </p>
                <p>
                  <span className="font-medium">Lugar de origen:</span>{" "}
                  {quote.pedido.cliente.lugar_origen ?? "-"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <h3 className="font-semibold">Datos del pedido</h3>

              <div className="mt-3 space-y-1 text-sm">
                <p>
                  <span className="font-medium">Código de pedido:</span>{" "}
                  {quote.pedido.id_pedido}
                </p>
                <p>
                  <span className="font-medium">Fecha de pedido:</span>{" "}
                  {formatDate(quote.pedido.fecha_pedido)}
                </p>
                <p>
                  <span className="font-medium">Entrega estimada:</span>{" "}
                  {formatDate(quote.pedido.fecha_entrega_estimada)}
                </p>
                <p>
                  <span className="font-medium">Estado del pedido:</span>{" "}
                  <StateBadge status={quote.pedido.estado} />
                </p>
                <p>
                  <span className="font-medium">Estado de proforma:</span>{" "}
                  <StateBadge status={quote.estado} />
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-semibold">Detalle de productos</h3>

            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-left">Producto</th>
                    <th className="px-4 py-3 text-left">Categoría</th>
                    <th className="px-4 py-3 text-right">Cantidad</th>
                    <th className="px-4 py-3 text-right">Precio unitario</th>
                    <th className="px-4 py-3 text-right">Subtotal</th>
                  </tr>
                </thead>

                <tbody>
                  {quote.pedido.detalle_pedido.map((detail) => (
                    <tr key={detail.id_detalle_pedido} className="border-t">
                      <td className="px-4 py-3 font-medium">
                        {detail.producto.nombre_producto}
                      </td>
                      <td className="px-4 py-3">
                        {detail.producto.categoria}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {Number(detail.cantidad.toString()).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(detail.precio_unitario)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(detail.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex justify-end">
            <div className="w-full max-w-sm space-y-2 rounded-lg border p-4">
              <div className="flex items-center justify-between text-sm">
                <span>Monto total</span>
                <span className="font-medium">
                  {formatMoney(quote.monto_total)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span>Adelanto inicial</span>
                <span className="font-medium">
                  {formatMoney(quote.adelanto_inicial, { emptyText: "-" })}
                </span>
              </div>

              <div className="border-t pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Saldo pendiente</span>
                  <span className="text-xl font-bold">
                    {formatMoney(quote.saldo)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 print:hidden lg:grid-cols-[1fr_1.2fr]">
              <PaymentForm
                action={createPaymentAction}
                quoteId={quote.id_proforma}
                currentBalance={quote.saldo.toString()}
                isPaid={
                  quote.estado === "anulada" ||
                  quote.estado === "pagada" ||
                  !hasCents(quote.saldo)
                }
                successNotification={commercialNotifications["payment-registered"]}
              />

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">Historial de pagos</h3>
                <p className="text-sm text-muted-foreground">
                  Pagos registrados para esta proforma.
                </p>

                <div className="mt-4 overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left">Fecha</th>
                        <th className="px-4 py-3 text-left">Tipo</th>
                        <th className="px-4 py-3 text-left">Método</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3 text-right">Saldo</th>
                      </tr>
                    </thead>

                    <tbody>
                      {quote.pago_cliente.map((payment) => (
                        <tr key={payment.id_pago_cliente} className="border-t">
                          <td className="px-4 py-3">{formatDate(payment.fecha_pago)}</td>
                          <td className="px-4 py-3">
                            {getOptionLabel(PAYMENT_TYPE_OPTIONS, payment.tipo_pago)}
                          </td>
                          <td className="px-4 py-3">
                            {getOptionLabel(PAYMENT_METHOD_OPTIONS, payment.metodo_pago)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatMoney(payment.monto_pagado)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatMoney(payment.saldo_actual)}
                          </td>
                        </tr>
                      ))}

                      {quote.pago_cliente.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-6 text-center text-muted-foreground"
                          >
                            Todavía no hay pagos registrados para esta proforma.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="grid gap-4 print:hidden lg:grid-cols-[1fr_1.2fr]">
              <ReceiptForm
                action={createReceiptAction}
                quoteId={quote.id_proforma}
                suggestedAmount={quote.monto_total.toString()}
                hasReceipt={Boolean(activeReceipt) || quote.estado === "anulada"}
                successNotification={commercialNotifications["receipt-created"]}
              />

              <div className="rounded-lg border p-4">
                <h3 className="font-semibold">Comprobantes emitidos</h3>
                <p className="text-sm text-muted-foreground">
                  Historial de comprobantes registrados para esta proforma.
                </p>

                <div className="mt-4 overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3 text-left">Fecha</th>
                        <th className="px-4 py-3 text-left">Tipo</th>
                        <th className="px-4 py-3 text-left">Número</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3 text-left">Estado</th>
                      </tr>
                    </thead>

                    <tbody>
                      {quote.comprobante_venta.map((receipt) => (
                        <tr key={receipt.id_comprobante} className="border-t">
                          <td className="px-4 py-3">
                            {formatDate(receipt.fecha_emision)}
                          </td>
                          <td className="px-4 py-3">
                            {getOptionLabel(RECEIPT_TYPE_OPTIONS, receipt.tipo_comprobante)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {receipt.numero_comprobante}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatMoney(receipt.monto_total)}
                          </td>
                          <td className="px-4 py-3">
                            <StateBadge status={receipt.estado} />
                          </td>
                        </tr>
                      ))}

                      {quote.comprobante_venta.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-6 text-center text-muted-foreground"
                          >
                            Todavía no hay comprobantes registrados para esta proforma.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

          {quote.observaciones && (
            <section className="rounded-lg border p-4">
              <h3 className="font-semibold">Observaciones</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {quote.observaciones}
              </p>
            </section>
          )}

          <footer className="border-t pt-6 text-sm text-muted-foreground">
            <p>
              Esta proforma es un documento comercial referencial. Los precios,
              cantidades y fechas quedan sujetos a confirmación del taller.
            </p>
            <p className="mt-2">
              Documento generado desde el Sistema de Gestión Integral para
              Industrias Aceros Perú.
            </p>
          </footer>
        </div>
      </section>
    </div>
  );
}
