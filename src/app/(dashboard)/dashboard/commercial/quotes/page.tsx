import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

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

export default async function QuotesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const quotes = await prisma.proforma.findMany({
    
    orderBy: {
      fecha_emision: "desc",
    },
    include: {
      comprobante_venta: {
        where: {
          estado: "emitido",
        },
        select: {
          id_comprobante: true,
          numero_comprobante: true,
          tipo_comprobante: true,
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

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Proformas</h1>
          <p className="text-sm text-muted-foreground">
            Lista de proformas digitales generadas desde pedidos registrados.
          </p>
        </div>

        <Link
          href="/dashboard/commercial/quotes/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Nueva proforma
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">N° Proforma</th>
              <th className="px-4 py-3 text-left">Pedido</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Productos</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Adelanto</th>
              <th className="px-4 py-3 text-left">Saldo</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Comprobante</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {quotes.map((quote) => {
              const productsText = quote.pedido.detalle_pedido
                .map((detail) => {
                  const cantidad = Number(detail.cantidad.toString());

                  return `${detail.producto.nombre_producto} x ${cantidad}`;
                })
                .join(" | ");

              return (
                <tr key={quote.id_proforma} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    {quote.numero_proforma}
                  </td>
                  <td className="px-4 py-3">{quote.id_pedido}</td>
                  <td className="px-4 py-3">
                    {quote.pedido.cliente.nombre_razon_social}
                  </td>
                  <td className="px-4 py-3">{productsText}</td>
                  <td className="px-4 py-3">
                    {formatDate(quote.fecha_emision)}
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(quote.monto_total)}
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(quote.adelanto_inicial)}
                  </td>
                  <td className="px-4 py-3">{formatMoney(quote.saldo)}</td>
                  <td className="px-4 py-3">{quote.estado}</td>
                  <td className="px-4 py-3">
                    {quote.comprobante_venta[0] ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        {quote.comprobante_venta[0].tipo_comprobante}{" "}
                        {quote.comprobante_venta[0].numero_comprobante}
                      </span>
                    ) : (
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                        Sin comprobante
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/commercial/quotes/${quote.id_proforma}`}
                        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Ver detalle
                      </Link>

                      {quote.estado !== "pagada" && quote.estado !== "anulada" && (
                        <Link
                          href={`/dashboard/commercial/quotes/${quote.id_proforma}`}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                        >
                          Registrar pago
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {quotes.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Todavía no hay proformas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}