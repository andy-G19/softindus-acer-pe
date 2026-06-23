import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ReceiptForm } from "@/components/commercial/receipt-form";
import { PaymentForm } from "@/components/commercial/payment-form";
import { auth } from "@/auth";
import { PrintButton } from "@/components/commercial/print-button";
import { prisma } from "@/lib/db";

type QuoteDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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
}: QuoteDetailPageProps) {
  const { id } = await params;

  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const quote = await prisma.proforma.findUnique({
    where: {
      id_proforma: id,
    },
    include: {
      comprobante_venta: {
        orderBy: {
          fecha_emision: "desc",
        },
      },
      pago_cliente: {
        orderBy: {
          fecha_pago: "desc",
        },
        include: {
          usuario: true,
        },
      },
      pedido: {
        include: {
          cliente: true,
          detalle_pedido: {
            include: {
              producto: true,
            },
          },
        },
      },
    },
  });

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

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Detalle de proforma</h1>
          <p className="text-sm text-muted-foreground">
            Revisa, imprime o guarda la proforma como PDF desde el navegador.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/commercial/quotes"
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Volver
          </Link>

          <PrintButton />
        </div>
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
                  {quote.pedido.estado}
                </p>
                <p>
                  <span className="font-medium">Estado de proforma:</span>{" "}
                  {quote.estado}
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
                  {formatMoney(quote.adelanto_inicial)}
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
                quoteId={quote.id_proforma}
                currentBalance={quote.saldo.toString()}
                isPaid={quote.estado === "pagada" || Number(quote.saldo.toString()) <= 0}
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
                          <td className="px-4 py-3">{payment.tipo_pago}</td>
                          <td className="px-4 py-3">{payment.metodo_pago}</td>
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
                quoteId={quote.id_proforma}
                suggestedAmount={quote.monto_total.toString()}
                hasReceipt={Boolean(activeReceipt)}
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
                          <td className="px-4 py-3">{receipt.tipo_comprobante}</td>
                          <td className="px-4 py-3 font-medium">
                            {receipt.numero_comprobante}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatMoney(receipt.monto_total)}
                          </td>
                          <td className="px-4 py-3">{receipt.estado}</td>
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
    </main>
  );
}