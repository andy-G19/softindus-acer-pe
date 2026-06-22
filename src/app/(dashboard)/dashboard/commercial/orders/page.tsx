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

export default async function OrdersPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!["ADMIN", "SELLER"].includes(session.user.role ?? "")) {
    redirect("/dashboard/access-denied");
  }

  const orders = await prisma.pedido.findMany({
    orderBy: {
      fecha_pedido: "desc",
    },
    include: {
      cliente: true,
      detalle_pedido: {
        include: {
          producto: true,
        },
      },
    },
  });

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Lista de pedidos registrados por cliente y sus productos asociados.
          </p>
        </div>

        <Link
          href="/dashboard/commercial/orders/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Nuevo pedido
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Fecha pedido</th>
              <th className="px-4 py-3 text-left">Entrega estimada</th>
              <th className="px-4 py-3 text-left">Productos</th>
              <th className="px-4 py-3 text-left">Monto estimado</th>
              <th className="px-4 py-3 text-left">Estado</th>
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

              return (
                <tr key={order.id_pedido} className="border-t">
                  <td className="px-4 py-3">{order.id_pedido}</td>
                  <td className="px-4 py-3 font-medium">
                    {order.cliente.nombre_razon_social}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(order.fecha_pedido)}
                  </td>
                  <td className="px-4 py-3">
                    {formatDate(order.fecha_entrega_estimada)}
                  </td>
                  <td className="px-4 py-3">{productsText}</td>
                  <td className="px-4 py-3">
                    {formatMoney(order.monto_estimado)}
                  </td>
                  <td className="px-4 py-3">{order.estado}</td>
                </tr>
              );
            })}

            {orders.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-muted-foreground"
                >
                  Todavía no hay pedidos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}