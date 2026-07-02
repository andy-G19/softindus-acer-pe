import Link from "next/link";
import { redirect } from "next/navigation";

import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  buildDateRangeFilter,
  parseDateParam,
  parseStringParam,
  type SearchParamsRecord,
} from "@/lib/search-params";

type CustomerPaymentsPageProps = {
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

export default async function CustomerPaymentsPage({
  searchParams,
}: CustomerPaymentsPageProps) {
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
  const method = parseStringParam(params, "method");
  const type = parseStringParam(params, "type");
  const dateRange = buildDateRangeFilter(
    parseDateParam(params, "from"),
    parseDateParam(params, "to"),
  );
  const filters: Prisma.pago_clienteWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { id_pedido: { contains: q, mode: "insensitive" } },
        { id_proforma: { contains: q, mode: "insensitive" } },
        {
          proforma: {
            pedido: {
              cliente: {
                nombre_razon_social: { contains: q, mode: "insensitive" },
              },
            },
          },
        },
      ],
    });
  }

  if (client) {
    filters.push({
      proforma: {
        pedido: {
          id_cliente: client,
        },
      },
    });
  }

  if (order) {
    filters.push({ id_pedido: order });
  }

  if (method) {
    filters.push({ metodo_pago: method });
  }

  if (type) {
    filters.push({ tipo_pago: type });
  }

  if (dateRange) {
    filters.push({ fecha_pago: dateRange });
  }

  const [payments, clients, orders] = await Promise.all([
    prisma.pago_cliente.findMany({
      where: filters.length > 0 ? { AND: filters } : {},
      orderBy: {
        fecha_pago: "desc",
      },
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
        usuario: true,
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
      <section>
        <h1 className="text-2xl font-bold">Pagos de cliente</h1>
        <p className="text-sm text-muted-foreground">
          Consulta pagos registrados desde proformas.
        </p>
      </section>

      <form
        action="/dashboard/commercial/payments"
        className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-6"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar pago..."
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
          name="method"
          defaultValue={method}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Metodo</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="yape">Yape</option>
          <option value="plin">Plin</option>
          <option value="otro">Otro</option>
        </select>
        <select
          name="type"
          defaultValue={type}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Tipo pago</option>
          <option value="adelanto">Adelanto</option>
          <option value="amortizacion">Amortizacion</option>
          <option value="cancelacion">Cancelacion</option>
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
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Filtrar
          </button>
          <Link
            href="/dashboard/commercial/payments"
            className="rounded-md border px-4 py-2 text-sm font-medium"
          >
            Limpiar filtros
          </Link>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Pedido</th>
              <th className="px-4 py-3 text-left">Proforma</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Metodo</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id_pago_cliente} className="border-t">
                <td className="px-4 py-3">{formatDate(payment.fecha_pago)}</td>
                <td className="px-4 py-3">
                  {payment.proforma.pedido.cliente.nombre_razon_social}
                </td>
                <td className="px-4 py-3">{payment.id_pedido}</td>
                <td className="px-4 py-3">{payment.id_proforma}</td>
                <td className="px-4 py-3">{payment.tipo_pago}</td>
                <td className="px-4 py-3">{payment.metodo_pago}</td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(payment.monto_pagado)}
                </td>
                <td className="px-4 py-3 text-right">
                  {formatMoney(payment.saldo_actual)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/commercial/quotes/${payment.id_proforma}`}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                  >
                    Ver proforma
                  </Link>
                </td>
              </tr>
            ))}
            {payments.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Todavia no hay pagos registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
