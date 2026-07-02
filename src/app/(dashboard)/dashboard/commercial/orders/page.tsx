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
import { cancelOrderAction } from "@/modules/commercial/orders/actions";

type OrdersPageProps = {
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

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
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
  const product = parseStringParam(params, "product");
  const status = parseStringParam(params, "status");
  const from = parseDateParam(params, "from");
  const to = parseDateParam(params, "to");
  const dateRange = buildDateRangeFilter(from, to);
  const filters: Prisma.pedidoWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        {
          id_pedido: {
            contains: q,
            mode: "insensitive",
          },
        },
        {
          cliente: {
            nombre_razon_social: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          detalle_pedido: {
            some: {
              producto: {
                nombre_producto: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ],
    });
  }

  if (client) {
    filters.push({ id_cliente: client });
  }

  if (product) {
    filters.push({
      detalle_pedido: {
        some: {
          id_producto: product,
        },
      },
    });
  }

  if (status) {
    filters.push({ estado: status });
  }

  if (dateRange) {
    filters.push({ fecha_pedido: dateRange });
  }

  const where: Prisma.pedidoWhereInput =
    filters.length > 0 ? { AND: filters } : {};

  const [orders, clients, products] = await Promise.all([
    prisma.pedido.findMany({
      where,
      orderBy: {
        fecha_pedido: "desc",
      },
      include: {
        cliente: true,
        comprobante_venta: {
          select: {
            id_comprobante: true,
          },
        },
        proforma: {
          where: {
            estado: {
              in: ["vigente", "aceptada", "pagada"],
            },
          },
          select: {
            id_proforma: true,
            numero_proforma: true,
            estado: true,
          },
        },
        detalle_pedido: {
          include: {
            producto: true,
            orden_trabajo: {
              select: {
                id_orden_trabajo: true,
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
    prisma.producto.findMany({
      orderBy: {
        nombre_producto: "asc",
      },
      select: {
        id_producto: true,
        nombre_producto: true,
      },
    }),
  ]);

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Lista de pedidos registrados por cliente y productos asociados.
          </p>
        </div>

        <Link
          href="/dashboard/commercial/orders/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Nuevo pedido
        </Link>
      </div>

      <form
        action="/dashboard/commercial/orders"
        className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-6"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar pedido..."
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
          name="product"
          defaultValue={product}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los productos</option>
          {products.map((item) => (
            <option key={item.id_producto} value={item.id_producto}>
              {item.nombre_producto}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={status}
          className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300"
        >
          <option value="">Todos los estados</option>
          <option value="registrado">Registrado</option>
          <option value="aprobado">Aprobado</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <div className="grid gap-2 sm:grid-cols-2 md:col-span-2">
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
            href="/dashboard/commercial/orders"
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
              <th className="px-4 py-3 text-left">Codigo</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Fecha pedido</th>
              <th className="px-4 py-3 text-left">Entrega estimada</th>
              <th className="px-4 py-3 text-left">Productos</th>
              <th className="px-4 py-3 text-left">Monto estimado</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Proforma</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => {
              const productsText = order.detalle_pedido
                .map((detail) => {
                  const cantidad = Number(detail.cantidad.toString());

                  return `${detail.producto.nombre_producto} x ${cantidad}`;
                })
                .join(" | ");
              const activeQuote = order.proforma[0];
              const hasWorkOrder = order.detalle_pedido.some(
                (detail) => detail.orden_trabajo.length > 0,
              );
              const canGenerateQuote =
                ["registrado", "aprobado"].includes(order.estado) &&
                !activeQuote;
              const canEdit =
                order.estado !== "cancelado" &&
                !activeQuote &&
                order.comprobante_venta.length === 0 &&
                !hasWorkOrder;

              return (
                <tr key={order.id_pedido} className="border-t">
                  <td className="px-4 py-3">{order.id_pedido}</td>
                  <td className="px-4 py-3 font-medium">
                    {order.cliente.nombre_razon_social}
                  </td>
                  <td className="px-4 py-3">{formatDate(order.fecha_pedido)}</td>
                  <td className="px-4 py-3">
                    {formatDate(order.fecha_entrega_estimada)}
                  </td>
                  <td className="px-4 py-3">{productsText}</td>
                  <td className="px-4 py-3">
                    {formatMoney(order.monto_estimado)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.estado} />
                  </td>
                  <td className="px-4 py-3">
                    {activeQuote ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        {activeQuote.numero_proforma}
                      </span>
                    ) : (
                      <StatusBadge status="sin-proforma" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/commercial/orders/${order.id_pedido}`}
                        className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                      >
                        Ver detalle
                      </Link>
                      {canEdit ? (
                        <Link
                          href={`/dashboard/commercial/orders/${order.id_pedido}/edit`}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                          Editar
                        </Link>
                      ) : null}
                      {activeQuote ? (
                        <Link
                          href={`/dashboard/commercial/quotes/${activeQuote.id_proforma}`}
                          className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                        >
                          Ver proforma
                        </Link>
                      ) : null}
                      {canGenerateQuote ? (
                        <Link
                          href={`/dashboard/commercial/quotes/new?orderId=${order.id_pedido}`}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                        >
                          Generar proforma
                        </Link>
                      ) : null}
                      {canEdit ? (
                        <form action={cancelOrderAction}>
                          <input
                            type="hidden"
                            name="id_pedido"
                            value={order.id_pedido}
                          />
                          <button
                            type="submit"
                            className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                          >
                            Cancelar
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}

            {orders.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Todavia no hay pedidos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
