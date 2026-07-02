import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/commercial/status-badge";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";
import { annulQuoteAction } from "@/modules/commercial/quotes/actions";

type QuotesPageProps = {
  searchParams?: Promise<SearchParamsRecord>;
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

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const params = (await searchParams) ?? {};
  const q = parseStringParam(params, "q");
  const client = parseStringParam(params, "client");
  const order = parseStringParam(params, "order");
  const status = parseStringParam(params, "status");
  const balance = parseStringParam(params, "balance");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const dateRange = buildDateRangeFilter(from, to);
  const filters: Prisma.proformaWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          numero_proforma: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          id_pedido: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          pedido: {
            cliente: {
              nombre_razon_social: {
                contains: q,
                mode: "insensitive",
              },
            },
          },
        },
      ],
    });
  }

  if (client) {
    filters.push({
      pedido: {
        id_cliente: client,
      },
    });
  }

  if (order) {
    filters.push({ id_pedido: order });
  }

  if (status) {
    filters.push({ estado: status });
  }

  if (balance === "pending") {
    filters.push({
      saldo: {
        gt: 0,
      },
    });
  }

  if (balance === "paid") {
    filters.push({
      saldo: 0,
    });
  }

  if (dateRange) {
    filters.push({ fecha_emision: dateRange });
  }

  const where: Prisma.proformaWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [quotes, clients, orders] = await Promise.all([
    prisma.proforma.findMany({
      where,
      orderBy: {
        fecha_emision: "desc",
      },
      include: {
        pago_cliente: {
          select: {
            id_pago_cliente: true,
          },
        },
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
    }),
    prisma.cliente.findMany({
      orderBy: {
        nombre_razon_social: "asc",
      },
      select: {
        id_cliente: true,
        nombre_razon_social: true,
      },
    }),
    prisma.pedido.findMany({
      orderBy: {
        fecha_pedido: "desc",
      },
      select: {
        id_pedido: true,
      },
    }),
  ]);

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

      <form
        action="/dashboard/commercial/quotes"
        className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-6"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar proforma..."
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        />
        <select
          name="client"
          defaultValue={client}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los clientes</option>
          {clients.map((item) => (
            <option key={item.id_cliente} value={item.id_cliente}>
              {item.nombre_razon_social}
            </option>
          ))}
        </select>
        <select
          name="order"
          defaultValue={order}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los pedidos</option>
          {orders.map((item) => (
            <option key={item.id_pedido} value={item.id_pedido}>
              {item.id_pedido}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los estados</option>
          <option value="vigente">Vigente</option>
          <option value="aceptada">Aceptada</option>
          <option value="pagada">Pagada</option>
          <option value="anulada">Anulada</option>
        </select>
        <select
          name="balance"
          defaultValue={balance}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los saldos</option>
          <option value="pending">Con saldo</option>
          <option value="paid">Sin saldo</option>
        </select>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            name="from"
            type="date"
            defaultValue={parseStringParam(params, "from")}
            className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
          <input
            name="to"
            type="date"
            defaultValue={parseStringParam(params, "to")}
            className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <div className="flex gap-2 md:col-span-6">
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Filtrar
          </button>
          <Link
            href="/dashboard/commercial/quotes"
            className="rounded-md border px-4 py-2 text-sm font-medium transition hover:bg-muted"
          >
            Limpiar filtros
          </Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">Nro. Proforma</th>
              <th className="px-4 py-3 text-left">Pedido</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Saldo</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Comprobante</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {quotes.map((quote) => {
              const canPay =
                quote.estado !== "pagada" &&
                quote.estado !== "anulada" &&
                Number(quote.saldo.toString()) > 0;
              const canAnnul =
                quote.estado !== "anulada" &&
                quote.pago_cliente.length === 0 &&
                quote.comprobante_venta.length === 0;

              return (
                <tr key={quote.id_proforma} className="border-t">
                  <td className="px-4 py-3 font-medium">
                    {quote.numero_proforma}
                  </td>
                  <td className="px-4 py-3">{quote.id_pedido}</td>
                  <td className="px-4 py-3">
                    {quote.pedido.cliente.nombre_razon_social}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(quote.fecha_emision)}
                  </td>
                  <td className="px-4 py-3">
                    {formatMoney(quote.monto_total)}
                  </td>
                  <td className="px-4 py-3">{formatMoney(quote.saldo)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={quote.estado} />
                  </td>
                  <td className="px-4 py-3">
                    {quote.comprobante_venta[0] ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        {quote.comprobante_venta[0].tipo_comprobante}{" "}
                        {quote.comprobante_venta[0].numero_comprobante}
                      </span>
                    ) : (
                      <StatusBadge status="sin-comprobante" />
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
                      {canPay ? (
                        <Link
                          href={`/dashboard/commercial/quotes/${quote.id_proforma}`}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                        >
                          Registrar pago
                        </Link>
                      ) : null}
                      {canAnnul ? (
                        <form action={annulQuoteAction}>
                          <input
                            type="hidden"
                            name="id_proforma"
                            value={quote.id_proforma}
                          />
                          <button
                            type="submit"
                            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            Anular
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}

            {quotes.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Todavia no hay proformas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
